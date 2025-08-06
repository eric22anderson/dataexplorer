from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import asyncio
import json
import random
import os
from langchain_anthropic import ChatAnthropic
from google.cloud import bigquery
from visualization import generate_chart_data

# I can add any dataset names to this list and the tool will automatically analyze them to see if they can be used to answer questions
DATASETS = 'physionet-data:mimiciv_3_1_icu','physionet-data:mimiciv_3_1_hosp'

# Since this is my personal anthropic api key, I don't want to share it... I may add some logic to test and see if the key is not null 
# before starting. This will ensure someone does not accidently run it without a key. 
ANTHROPIC_API_KEY = "Add your own key here"

# Extra charting tools can be added here
CHART_LIBRARIES = ['plotly', 'chartjs', 'matplotlib', 'seaborn']
os.environ["ANTHROPIC_API_KEY"] = ANTHROPIC_API_KEY

AI_MODEL = "claude-3-7-sonnet-20250219"

# Create router for chat endpoints
router = APIRouter()

# Pydantic models
class ChatMessage(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str


@router.post("/chat")
async def chat_message(chat_message: ChatMessage):
    """Send a chat message and receive a streaming response"""

    async def generate_chat_stream():
        """Generator function to stream chat responses"""
        try:
             # Update 1: Send working message (one of a few random messages just to keep it interesting)
            validation_message = working_message(chat_message.message)
            yield f"data: {json.dumps({'type': 'message', 'content': validation_message})}\n\n"
            
            
            # Determine if the message needs a chart and if so, which kind
            yield f"data: {json.dumps({'type': 'message', 'content': 'Checking for visualization options...'})}\n\n"
            chart_analysis = check_for_chart(chat_message.message)
            
            # Now we know what kind of chart to use (if any)
            if chart_analysis["library"] != "NONE":
                if chart_analysis["chart"] == "No good options":
                    yield f"data: {json.dumps({'type': 'message', 'content': 'Visualization requested but no suitable options available.'})}\n\n"
                else:
                    viz_message = f'I picked a chart type: {chart_analysis["chart"]} using {chart_analysis["library"]}'
                    yield f"data: {json.dumps({'type': 'message', 'content': viz_message})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'message', 'content': 'No visualization requested.'})}\n\n"

            
            # Process the question and stream status updates
            query_results = None
            sql_query = None
            response_content = None
            
            async for message_or_result in answer_question(chat_message.message, ANTHROPIC_API_KEY):
                # Check if this is the final return value (tuple with FINAL_RESULT marker) or a streaming message
                if isinstance(message_or_result, tuple) and message_or_result[0] == 'FINAL_RESULT':
                    _, response_content, sql_query, query_results = message_or_result
                    break
                else:
                    yield message_or_result
            # At this point, we now know if we can answer the question, but we still have raw query results to process
            # Now the hard part, we need to convert the data to the right "format" for the charting library

            # Generate chart if we have query results
            yield f"data: {json.dumps({'type': 'message', 'content': 'Converting the data and building the chart....'})}\n\n"

            #Note: generate_chart_data is a function that takes the query results and the chart analysis to create the chart data
            # It's found int he visualization.py module. 
            chart_data = generate_chart_data(query_results, chart_analysis, chat_message.message)  
            yield f"data: {json.dumps(chart_data)}\n\n"
            
            # Final completion signal
            await asyncio.sleep(1)
            yield f"data: {json.dumps({'type': 'message', 'content': 'Processing complete!'})}\n\n"

        except Exception as e:
            # Send error in stream format
            print(f"Error during chat processing: {str(e)}")
            error_data = {
                'type': 'error',
                'message': f"Error: {str(e)}"
            }
            yield f"data: {json.dumps(error_data)}\n\n"

    # I need to stream otherwise the "chain of though" messages will all appear at once. I want the tool to 
    # keep the user up to speed on what is going on behind the scenes. 
    return StreamingResponse(
        generate_chat_stream(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream"
        }
    )

# Helper functions that simulate real processing steps
def working_message(message: str) -> str:
    # Send one of several possible responses that tells the user that the message is being processed
    # It feels a bit more human to have a few different messages
    
    messages = [
        "Give me a few minutes, I'm analyzing your request...",
        "Please hold on while I process your message...",
        "I'm working on your request, this will take just a moment...",
        "Analyzing your input, please wait a few seconds...",
        "Processing your message now, hang tight...",
        "I'm carefully reviewing your request, please be patient it may take a moment...",
        "Give me a moment to examine your message thoroughly...",
        "Working on your query, I'll have an answer shortly...",
        "Let me analyze this for you, it'll just take a minute...",
        "I'm processing your request, please wait while I work on it..."
    ]
    
    return random.choice(messages)

def check_for_chart(message: str):
    #Analyze the message to determine if a chart/visualization is requested
    
    # Set up the prompt for chart analysis
    prompt = f"""
    Analyze the following user message to determine if they are requesting any kind of chart, graph, or visualization.

    User Message: "{message}"

    Available chart libraries: {', '.join(CHART_LIBRARIES)}

    Instructions:
    1. If the user is requesting a chart, graph, plot, or any visualization, choose the most appropriate library from the available options
    2. Also specify what type of chart would be best (e.g., "bar chart", "line graph", "scatter plot", "pie chart", etc.)
    3. If no visualization is requested, return "NONE" for both library and chart
    4. If a visualization is requested but none of the available libraries are suitable, return "NONE" for library and "No good options" for chart

    Respond in this exact format:
    LIBRARY: [library name or NONE]
    CHART: [chart type or NONE or "No good options"]
    """
    
    try:
        # Initialize Claude LLM
        llm = ChatAnthropic(
            model=AI_MODEL,
            temperature=0
        )
        
        # Get response from LLM
        response = llm.invoke(prompt)
        response_content = response.content
        print(f"LLM Response: {response_content}")

        library = "NONE"
        chart = "NONE"
        
        #If I was running this in anything but a POC, I would probably convert the prompt to use JSON as an output vs string searching. 
        if "LIBRARY:" in response_content:
            library_line = [line for line in response_content.split('\n') if 'LIBRARY:' in line][0]
            library = library_line.split('LIBRARY:')[1].strip()
            
        if "CHART:" in response_content:
            chart_line = [line for line in response_content.split('\n') if 'CHART:' in line][0]
            chart = chart_line.split('CHART:')[1].strip()
            
        return {"library": library, "chart": chart}
        
    except Exception as e:
        print(f"Error in check_for_chart: {e}")
        return {"library": "NONE", "chart": "NONE"}

def format_schema_for_prompt(schema_info):
        #Format schema information for the LLM prompt, this just makes it easier for the LLM to read and understand
        schema_text = "Available BigQuery tables and columns:\n\n"
        
        for table_name, table_info in schema_info.items():
            schema_text += f"Table: {table_name}\n"
            schema_text += f"Description: {table_info['description']}\n"
            schema_text += f"Rows: {table_info['num_rows']:,}\n"
            schema_text += "Columns:\n"
            
            for col in table_info['columns']:
                schema_text += f"  - {col['name']} ({col['type']}): {col['description']}\n"
            
            schema_text += "\n"
        
        return schema_text

def get_schema(project_id, dataset_id):
    """Get schema information from BigQuery dataset (non-streaming version)"""
    
    # First, check if a local schema file exists
    schema_filename = f'{dataset_id}_schema.json'
    if os.path.exists(schema_filename):
        try:
            with open(schema_filename, 'r') as f:
                schema_info = json.load(f)
            return schema_info
        except Exception as e:
            print(f"Error reading local schema file: {e}")
            print("Falling back to BigQuery API...")
    
    # If no local file exists or there was an error, query BigQuery
    try:
        # Use the client without specifying credentials - it will use the environment variable
        client = bigquery.Client(project=project_id)
        print(f"Successfully connected to BigQuery project: {client.project}")
    except Exception as e:
        print(f"Failed to create BigQuery client: {e}")
        raise
    dataset_ref = client.dataset(dataset_id)
    
    schema_info = {}
    tables = client.list_tables(dataset_ref)
    
    for table in tables:
        table_ref = dataset_ref.table(table.table_id)
        table_obj = client.get_table(table_ref)
        
        # Get column information
        columns = []
        for field in table_obj.schema:
            columns.append({
                'name': field.name,
                'type': field.field_type,
                'description': field.description or 'No description'
            })
        
        schema_info[table.table_id] = {
            'columns': columns,
            'description': table_obj.description or 'No description',
            'num_rows': table_obj.num_rows
        }
    
    # Save schema_info to a file, this will allow us to use the schema in the future without having to query BigQuery again
    with open(f'{dataset_id}_schema.json', 'w') as f:
        json.dump(schema_info, f, indent=2)
    print(f"Schema information saved to {dataset_id}_schema.json, will be used for future queries.")

    return schema_info


async def answer_question(question, anthropic_api_key):
    #Determine if BigQuery databases can answer the given question (streaming version)
    
    # Set Anthropic API key
    #os.environ["ANTHROPIC_API_KEY"] = anthropic_api_key
    
    # Get schemas for all datasets 
    all_schemas_text = "Database Schemas:\n\n"

    yield f"data: {json.dumps({'type': 'message', 'content': f'Analyzing schemas to determine best dataset...'})}\n\n"
        
    # Right now I'm just supporting bigQuery, but in the future, adding additional technologies should be easy
    for dataset_full_name in DATASETS:
        project_id, dataset_id = dataset_full_name.split(':')
        
        schema_info = get_schema(project_id, dataset_id)
        schema_text = format_schema_for_prompt(schema_info)
        
        all_schemas_text += f"=== {dataset_full_name} ===\n"
        all_schemas_text += schema_text
        all_schemas_text += "\n"
    
   
    # Create prompt to analyze the question and compare to schemas. This will tell us if the LLM can 
    # build SQL to answer the question. 
    prompt = f"""
        You are a data analyst examining which BigQuery database (if any) can best answer a specific question.

        Question: {question}

        {all_schemas_text}

        Based on the available tables and columns across all databases, can any of these databases answer the question?

        Respond with:
        1. YES or NO
        2. Explanation of your reasoning
        3. If YES, which database and tables/columns would be needed
        4. If NO, what data is missing
        5. If able, build a SQL query that can be used in bigquery to answer the question.

        Format your response as:
        
        ANSWER: [YES/NO]
        
        DATABASE: [Which database from the available ones]
        
        REASONING: [Your explanation]
        
        REQUIRED_DATA: [Tables and columns needed, or what's missing]

        SQL QUERY:

        """
    
    # Initialize Claude LLM
    llm = ChatAnthropic(
        model=AI_MODEL,
        #model="claude-sonnet-4-20250514",
        temperature=0
    )
    
    # Create and run the prompt
    response = llm.invoke(prompt)
    
    # Extract SQL if the answer is YES
    sql_query = None
    response_content = response.content
    
    if "ANSWER: YES" in response_content:
        # Look for SQL statement between triple quotes
        import re
        sql_pattern = r"```(?:sql)?\s*(.*?)\s*```"
        sql_match = re.search(sql_pattern, response_content, re.DOTALL | re.IGNORECASE)
        if sql_match:
            sql_query = sql_match.group(1).strip()
            # Remove the SQL block from the response
            response_content = re.sub(sql_pattern, "", response_content, flags=re.DOTALL | re.IGNORECASE).strip()
        
        # Also remove the "SQL QUERY:" section header if it exists
        response_content = re.sub(r"SQL QUERY:\s*", "", response_content, flags=re.IGNORECASE).strip()
    
    # Send the result minus the SQL query
    yield f"data: {json.dumps({'type': 'message', 'content': response_content})}\n\n"
    
    # If there's a SQL query, try to execute it. 
    if sql_query:
        yield f"data: {json.dumps({'type': 'message', 'content': f'Running dynamically generated query'})}\n\n"
        # Execute the SQL query against BigQuery
        client = bigquery.Client(project="mimiciii-eric")
        query_job = client.query(sql_query)
        results = query_job.result()
        
        # Collect results for return
        query_results = []
        for row in results:
            row_dict = dict(row)
            query_results.append(row_dict)
            #yield f"data: {json.dumps({'type': 'message', 'content': f'Result: {row_dict}'})}\n\n"
        
        # Yield the final results with a special marker
        yield ('FINAL_RESULT', response_content, sql_query, query_results)
    else:
        # Yield final results with None for sql_query and results if no query was executed
        #Note: To add, every once in a while, the LLM generates an error in the querry. I can capture
        # the error and send it back for corrections and re-execute the "fixed" query. I have not added 
        # this yet, but it's certainly possible. 
        yield ('FINAL_RESULT', response_content, sql_query, None)
