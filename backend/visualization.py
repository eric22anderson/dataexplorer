import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg') 
import seaborn as sns
import base64
import io
import json
import os
import numpy as np
import pandas as pd
from langchain_anthropic import ChatAnthropic

# Import plotly
import plotly.graph_objects as go
import plotly.express as px


def generate_chart_data(query_results, chart_analysis, original_user_message=None):
    # This was a tough function to write, but I think it works well now
    # it uses an LLM to generate Python code that creates a chart based on the query results
    # The return is a dictionary that contains the chart data in the expected format
    # I found it easiest to generate python code that creates the chart, then dynamicall execute that code

    # Extract chart details from analysis
    library = chart_analysis.get("library", "matplotlib").lower()
    chart_type = chart_analysis.get("chart", "line chart").lower()
    
    
    # If no visualization requested or no data, return None
    if library == "none" or not query_results:
        return None
    
    # Prepare data for the prompt
    raw_query_results = json.dumps(query_results, indent=2) if query_results else "No data available"
    user_request = original_user_message or "Generate a visualization"
    
    # Load the prompt template from external file
    prompt_file_path = os.path.join(os.path.dirname(__file__), 'python_code_generation_prompt.txt')
    
    try:
        with open(prompt_file_path, 'r', encoding='utf-8') as f:
            prompt_template = f.read()
    except FileNotFoundError:
        print(f"Error: Could not find prompt file at {prompt_file_path}")
        return create_fallback_chart()
    
    # Replace the tokens with actual values
    prompt = prompt_template.format(
        chart_type=chart_type,
        library=library,
        raw_query_results=raw_query_results,
        user_request=user_request
    )
    
    try:
        # Initialize Claude LLM
        llm = ChatAnthropic(
            model="claude-3-7-sonnet-20250219",
            temperature=0
        )
        
        # Get response from LLM
        response = llm.invoke(prompt)
        code = response.content.strip()
        
        # Clean up the code (remove markdown formatting if present) Claude seems to always include markdown even If I ask it not to.
        if "```python" in code:
            code = code.split("```python")[1].split("```")[0].strip()
        elif "```" in code:
            code = code.split("```")[1].split("```")[0].strip()
        
        # Remove any import statements that the LLM might have included
        # I had to add this because even though I note it multiple times, the LLM still includes imports
        # This is a workaround to ensure no imports are included
        lines = code.split('\n')
        filtered_lines = []
        for line in lines:
            stripped_line = line.strip()
            if not (stripped_line.startswith('import ') or stripped_line.startswith('from ')):
                filtered_lines.append(line)
        
        code = '\n'.join(filtered_lines)
        
        print(f"Generated Code:\n{code}")
        
        # Execute the generated code
        chart_result = execute_chart_code(code, query_results)
        
        if chart_result:
            # Wrap in the expected format
            final_result = {
                'type': 'graph',
                'description': f'{chart_type.title()} chart generated using {library}',
                'graphType': chart_result.get('graphType', library),
                'graphData': {
                    key: value for key, value in chart_result.items() 
                    if key != 'graphType'
                }
            }
            
            print(f"Generated Chart Data: {json.dumps(final_result, indent=2)}")
            return final_result
        else:
            raise Exception("Code execution returned no result")
        
    except Exception as e:
        print(f"Error in generate_chart_data: {e}")
        print(f"Generated Code: {code if 'code' in locals() else 'No code generated'}")
        # Fallback to hardcoded matplotlib chart
        return create_fallback_chart()

def execute_chart_code(code, data):
    # Now that we dynamically generated the code (that generates the chart), we need to execute it safely

    try:
        # Print the actual data structure... I needed this to debug what the LLM was generating
        print(f"Data structure for chart generation:")
        print(f"Data type: {type(data)}")
        if data:
            print(f"Data length: {len(data)}")
            print(f"First few items: {data[:3] if len(data) > 0 else 'No data'}")
            if len(data) > 0 and isinstance(data[0], dict):
                print(f"Available keys in first item: {list(data[0].keys())}")
        else:
            print("No data provided")
        
        # Create safe execution environment with required imports and data
        safe_globals = {
            # Core Python
            '__builtins__': {
                '__import__': __import__,
                'len': len,
                'range': range,
                'enumerate': enumerate,
                'zip': zip,
                'list': list,
                'dict': dict,
                'str': str,
                'int': int,
                'float': float,
                'min': min,
                'max': max,
                'sum': sum,
                'sorted': sorted,
                'abs': abs,
                'round': round,
                'tuple': tuple,
                'print': print,  
                'type': type,    
                'isinstance': isinstance, 
                'set': set,     
            },
            
            # Data processing
            'json': json,
            'base64': base64,
            'io': io,
            'data': data, 
            
            # Visualization libraries
            'matplotlib': matplotlib,
            'plt': plt,
            'seaborn': sns,
            'sns': sns,
            
            # Data libraries
            'numpy': np,
            'np': np,
            'pandas': pd,
            'pd': pd,
        }
        
        def plotly_to_dict(fig):
            # this Convert plotly figure to JSON-serializable format
            # If I directly dumped a plotly figure, it would not be JSON serializable and fail. I had to convert them first. 
            # I tried using plotly's fig.to_dict() but it did not always work (not sure why), so I added a fallback
            try:
                # Use plotly's built-in serialization (works most of the time)
                fig_dict = fig.to_dict()
                return {
                    "data": fig_dict.get("data", []),
                    "layout": fig_dict.get("layout", {})
                }
            except Exception as e:
                print(f"Error in plotly_to_dict: {e}")
                # Fallback method
                return {
                    "data": [dict(trace) for trace in fig.data],
                    "layout": dict(fig.layout)
                }
        
        safe_globals.update({
            'go': go,
            'px': px,
            'plotly_to_dict': plotly_to_dict
        })
        
        # Local variables for execution
        local_vars = {}
        
        # Execute the code
        exec(code, safe_globals, local_vars)
        
        # Return the result
        return local_vars.get('result')
        
    except Exception as e:
        print(f"Error executing chart code: {e}")
        return None

def create_fallback_chart():
    # this is more for debugging purposes, but if for some reason the code generation fails, we can still return a simple chart
    try:
        plt.figure(figsize=(10, 6))
        plt.plot([1, 2, 3, 4], [1, 4, 2, 3], marker='o')
        plt.title("Fallback Chart - Code Generation Error")
        plt.xlabel("X Values")
        plt.ylabel("Y Values")
        plt.grid(True, alpha=0.3)
        plt.tight_layout()

        # Convert to base64
        buffer = io.BytesIO()
        plt.savefig(buffer, format='png', dpi=300, bbox_inches='tight')
        buffer.seek(0)
        image_base64 = base64.b64encode(buffer.read()).decode()
        plt.close()

        fallback_data = {
            'type': 'graph',
            'graphType': 'image',
            'description': 'Fallback chart due to code generation error',
            'graphData': {
                'src': f'data:image/png;base64,{image_base64}',
                'alt': 'Fallback statistical plot'
            }
        }
        
        return fallback_data
        
    except Exception as e:
        print(f"Error creating fallback chart: {e}")
        return {
            'type': 'error',
            'content': 'Failed to generate chart visualization'
        }