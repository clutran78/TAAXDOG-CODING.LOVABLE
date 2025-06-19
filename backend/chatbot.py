import os
from flask import Blueprint, request, jsonify, Response
from dotenv import load_dotenv
import http.client
import json
import logging
# import google.generativeai as genai
import openai
import requests

# Load environment variables
load_dotenv()

# Setup logging
logger = logging.getLogger(__name__)

# Import Claude client for enhanced financial advice
try:
    from integrations.claude_client import get_claude_client
    claude_available = True
    logger.info("Claude client available for enhanced chatbot responses")
except ImportError:
    claude_available = False
    logger.warning("Claude client not available - using OpenRouter fallback")

# # Initialize Gemini
# genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))

# Create blueprint
chatbot_bp = Blueprint('chatbot', __name__)

# Formatting instructions for the LLM
formatting_instructions = """- Use **double asterisks** for bold text.
- Use *single asterisks* or _underscores_ for italic text.
- Use `-` for bullet points.
- Use `1.`, `2.`, etc. for numbered lists.
- Use [size=24]Text[/size] for text in font size 24.
- Use [size=16]Text[/size] for text in font size 16.
- When you need to go to the next line, write the **literal characters** `\\n`."""

def perform_web_search(query):
    """Perform web search using Serper API"""
    try:
        conn = http.client.HTTPSConnection("google.serper.dev")
        # Optimize search query to focus on Australian tax information
        search_query = f"{query} site:ato.gov.au OR site:my.gov.au OR site:moneysmart.gov.au applicable 2025"
        payload = json.dumps({
            "q": search_query
        })
        headers = {
            'X-API-KEY': os.getenv('SERPER_API_KEY'),
            'Content-Type': 'application/json'
        }
        conn.request("POST", "/search", payload, headers)
        res = conn.getresponse()
        data = json.loads(res.read().decode("utf-8"))
        
        # # Print web search results
        # print("\n=== Web Search Results ===")
        # print(json.dumps(data, indent=2))
        # print("=========================\n")
        
        return data
    except Exception as e:
        logger.error(f"Web search error: {str(e)}")
        return None

def get_llm_response_with_claude(message, search_results=None):
    """Get response from Claude with enhanced financial advice capabilities"""
    try:
        if not claude_available:
            logger.info("Claude not available, using OpenRouter fallback")
            return get_llm_response_openrouter(message, search_results)
        
        claude_client = get_claude_client()
        if not claude_client:
            logger.warning("Failed to get Claude client, using OpenRouter fallback")
            return get_llm_response_openrouter(message, search_results)
        
        # Prepare context for Claude
        context = {
            "user_message": message,
            "search_results": search_results
        }
        
        # Get Claude response
        claude_result = claude_client.generate_financial_advice(context)
        
        if claude_result.get("success"):
            response_text = claude_result.get("response", "")
            # Stream the response character by character
            for char in response_text:
                yield char
        else:
            logger.warning(f"Claude advice generation failed: {claude_result.get('error')}")
            # Fallback to OpenRouter
            for chunk in get_llm_response_openrouter(message, search_results):
                yield chunk
                
    except Exception as e:
        logger.error(f"Error in Claude response generation: {e}")
        # Fallback to OpenRouter
        for chunk in get_llm_response_openrouter(message, search_results):
            yield chunk

def get_llm_response_openrouter(message, search_results=None):
    """Fallback LLM response using OpenRouter when Claude is not available"""
    try:
        # Optimized system prompt focusing on key aspects
        system_prompt = f"""
        You are by the name of Dobbie, an AI-powered tax assistant for Australian taxpayers. Your responses should be:
        1. Clear and concise
        2. Based on official ATO sources
        3. Structured with bullet points or numbered lists
        4. Include relevant ATO references when available

        ## Tone
        - Make jokes and be friendly whenever suitable.
        - Do not use jargons.
        - Use simple words and sentences.
        - When complimented, make a joke and say "Thank you! I'm glad I could help. 😊"
        - When asked generic questions, make sure to answer them according to the context.

        ## Core Knowledge Areas:
        1. Tax Return Preparation
        2. Deductions and Claims
        3. Record Keeping Requirements
        4. Lodgement Methods and Deadlines
        5. Tax Categories (D1-D15, P8)

        ## Response Format:
        1. Start with a brief overview
        2. Provide step-by-step instructions
        3. Include important deadlines or requirements
        4. Add relevant ATO references
        5. End with a disclaimer about seeking professional advice

        ## Important Rules:
        - Only provide information from verified ATO sources
        - Include specific ATO reference numbers when available
        - Clearly state if information is from the current tax year
        - Highlight any deadlines or important dates
        - Mention record-keeping requirements
        - Do not start your response "Okay, I will now answer your question..." or anything similar.
        - When listing things, make sure to use bullet points or numbered lists.
        - In case of verified information attached, make sure to use it to answer and format it in a way that is easy to read.

        ## Formatting Instructions (must use these in every response):
        {formatting_instructions}

        ## Greeting [Only use this if the user greets you]
        "Hey there, I'm Dobbie — your tax-smart sidekick! 🐾
        I'm here to sniff out savings, explain ATO rules, and help you sort your finances without the jargon.
        Ask me anything about your tax return, expenses, or how to make your money bark louder.
        Ready to fetch some insights?

        ## For Reference:
        - ATO.gov.au
        - My.gov.au
        - Moneysmart.gov.au

        You may also use the attached information from the web-search, but only as a reference to answer the question.
        """

        # Prepare message with search results if available
        if search_results:
            # Extract relevant information from search results
            relevant_info = []
            if 'answerBox' in search_results:
                relevant_info.append(search_results['answerBox'].get('snippet', ''))
            
            # Extract top 3 organic results
            for result in search_results.get('organic', [])[:3]:
                relevant_info.append(f"{result.get('title', '')}: {result.get('snippet', '')}")
            
            # Add "People Also Ask" questions and answers
            for qa in search_results.get('peopleAlsoAsk', [])[:2]:
                relevant_info.append(f"Q: {qa.get('question', '')}\nA: {qa.get('snippet', '')}")
            
            message = f"Based on the following verified information:\n{json.dumps(relevant_info, indent=2)}\n\nUser question: {message}"
        
        """
        # Get response from LLM
        model = genai.GenerativeModel('gemini-2.0-flash')
        response = model.generate_content(
            contents=[system_prompt, message],
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
                top_p=0.8,
                top_k=40,
                max_output_tokens=1000,
            )
        )
        
        # Remove the first line from the LLM response
        response_lines = response.text.strip().split('\n')
        # Skip empty lines at the start
        while response_lines and response_lines[0].strip() == '':
            response_lines.pop(0)
        # Remove the first non-empty line if more than one line exists
        if len(response_lines) > 1:
            response_lines = response_lines[1:]
        cleaned_response = '\n'.join(response_lines).strip()
        """

        openai.api_base = "https://openrouter.ai/api/v1"
        openai.api_key = os.getenv('OPENROUTER_API_KEY')

        response = openai.ChatCompletion.create(
            model="anthropic/claude-3-7-sonnet",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message}
            ],
            stream=True
        )

        for chunk in response:
            if 'choices' in chunk and chunk['choices'][0]['delta'].get('content'):
                yield chunk['choices'][0]['delta']['content']

        # reply = response['choices'][0]['message']['content']
        # # Print LLM response
        # print("\n=== Open Router Response ===")
        # print(reply)
        # print("=====================\n")
        
        # return reply
    except Exception as e:
        logger.error(f"open router API error: {str(e)}")
        return None

@chatbot_bp.route('/chat', methods=['POST'])
def chat():
    """Handle chat requests"""
    try:
        data = request.get_json()
        if not data or 'message' not in data:
            return jsonify({"error": "No message provided"}), 400

        user_message = data['message']

        webhook_url = data.get('webhook_url')  # Optional webhook

        # print(f"\n=== User Message ===")
        # print(user_message)
        # print("===================\n")
        # Check if the message contains a question mark or question words
        question_words = ['what', 'why', 'how', 'when', 'where', 'who', 'which', 'whose', 'whom', 'help']
        is_question = '?' in user_message.lower() or any(word in user_message.lower().split() for word in question_words)
        # Check for generic questions that don't need web search
        generic_questions = [
            "what can you do",
            "what can you help me with",
            "what are your capabilities",
            "how can you help me",
            "what do you do",
            "what are you",
            "who are you",
            "what is your name",
            "what is your purpose",
            "what is your goal",
            "what is your mission",
            "what is your vision",
            "what is your goal",
        ]
        
        # If it's a generic question, don't perform web search
        if any(question in user_message.lower() for question in generic_questions):
            is_question = False
        # Only perform web search if it's a question
        search_results = perform_web_search(user_message) if is_question else None
        
        # # Get response from LLM
        # response = get_llm_response(user_message, search_results)
        
        # if response:
        #     return jsonify({
        #         "response": response,
        #         "search_results": search_results
        #     })
        # else:
        #     return jsonify({"error": "Failed to get response"}), 500
        def generate():
            buffer = ""
            # Use Claude-enhanced response generation with OpenRouter fallback
            for chunk in get_llm_response_with_claude(user_message, search_results):
                # Replace actual newlines with the literal characters `\n`
                chunk = chunk.replace("\n", "\\n")

                buffer += chunk
                yield chunk

                # Webhook support: send each chunk to webhook if provided
                if webhook_url:
                    try:
                        requests.post(webhook_url, json={"chunk": chunk})
                    except Exception as e:
                        logger.error(f"Webhook error: {e}")

            # Optionally, send the full response at the end
            if webhook_url:
                try:
                    requests.post(webhook_url, json={"full_response": buffer})
                except Exception as e:
                    logger.error(f"Webhook error (final): {e}")

        return Response(generate(), mimetype='text/plain')

    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        return jsonify({"error": str(e)}), 500
