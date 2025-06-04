import os
from flask import Blueprint, request, jsonify
from dotenv import load_dotenv
import http.client
import json
import logging
import google.generativeai as genai
import openai

# Load environment variables
load_dotenv()

# Setup logging
logger = logging.getLogger(__name__)

# Initialize Gemini
genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))

# Create blueprint
chatbot_bp = Blueprint('chatbot', __name__)

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
        
        # Print web search results
        print("\n=== Web Search Results ===")
        print(json.dumps(data, indent=2))
        print("=========================\n")
        
        return data
    except Exception as e:
        logger.error(f"Web search error: {str(e)}")
        return None

def get_gemini_response(message, search_results=None):
    """Get response from Gemini with optional search results"""
    try:
        # Optimized system prompt focusing on key aspects
        system_prompt = """
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
        # Get response from Gemini
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
        
        # Remove the first line from the Gemini response
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
            ]
        )

        reply = response['choices'][0]['message']['content']
        # Print Gemini response
        print("\n=== Open Router Response ===")
        print(reply)
        print("=====================\n")
        
        return reply
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
        print(f"\n=== User Message ===")
        print(user_message)
        print("===================\n")
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
        
        # Get response from Gemini
        response = get_gemini_response(user_message, search_results)
        
        if response:
            return jsonify({
                "response": response,
                "search_results": search_results
            })
        else:
            return jsonify({"error": "Failed to get response"}), 500

    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        return jsonify({"error": str(e)}), 500 