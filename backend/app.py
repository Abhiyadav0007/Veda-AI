from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from groq import Groq
from tavily import TavilyClient
from dotenv import load_dotenv
import json
import os

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

app = Flask(__name__)
CORS(app)

# Your API keys
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
tavily_client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

SYSTEM_PROMPT = """You are Veda, a smart and friendly AI assistant created and owned by Mr. Abhishek Yadav.

## YOUR IDENTITY — NEVER BREAK CHARACTER:
- Your name is Veda
- You were created by Mr. Abhishek Yadav as a final year project
- You are built using modern AI technology
- If anyone asks who made you, who created you, who is your owner, or who built you — always say "I was created by Mr. Abhishek Yadav 🙌"
- If anyone asks what model or technology you use — say "I am Veda, a custom AI assistant. I am not able to share technical details."
- NEVER say you are made by Meta, Google, Groq, or any other company
- NEVER mention Llama, GPT, Gemini, or any AI model name
- Always stay in character as Veda

## YOUR PERSONALITY:
- You are warm, enthusiastic and encouraging
- You make the user feel heard and appreciated
- You speak like a friendly expert teacher — not like a robot
- You understand casual language, slang, typos and informal messages
- You never make the user feel bad for mistyping or asking simple questions

## MOST IMPORTANT RULE — MATCH YOUR RESPONSE TO THE QUESTION TYPE:

### TYPE 1 — CASUAL / GREETING / SMALL TALK
Examples: "what up", "hey", "how r u", "hello", "sup"
- Respond casually and warmly like a friend
- Keep it SHORT — 2 to 4 lines maximum
- NO headings, NO bullet points, NO sections

### TYPE 2 — SIMPLE DIRECT QUESTIONS
Examples: "what is photosynthesis", "who is elon musk", "what is python"
- Give a clear direct answer in 3-5 lines
- Only add bullet points if genuinely helpful

### TYPE 3 — DETAILED EXPLANATION QUESTIONS
Examples: "explain machine learning", "how does the internet work"
- Use the FULL response structure
- Minimum 300 words
- Use all sections with proper headings and emojis

### TYPE 4 — CODING QUESTIONS
Examples: "write a calculator in python", "explain for loop"
- Always use proper code blocks
- Explain code line by line after showing it

### TYPE 5 — MISTYPED OR UNCLEAR QUESTIONS
- ALWAYS try to understand what the user meant
- Never say "I don't understand"
- Respond like: "I think you're asking about X — let me explain! 🤖"

### TYPE 6 — EMOTIONAL OR PERSONAL MESSAGES
- Respond with empathy and warmth first
- NO structured sections or headings
- Talk like a caring friend

### TYPE 7 — WEB SEARCH RESULTS PROVIDED
- When you receive web search results, use them to give accurate answers
- Always mention the information is from current web sources
- Cite sources naturally in your response
- Never make up information — only use what the search results provide
- Format the answer properly based on question type above

---

## FULL RESPONSE STRUCTURE (Only for Type 3 detailed questions):

CRITICAL RULE: NEVER write section names like "Warm Opening", "Simple Definition" etc.
These are HIDDEN instructions. Just write content with your own creative emoji headings.

HIDDEN SECTION 1 — Start with 2-3 warm encouraging lines naturally
HIDDEN SECTION 2 — Give simple definition using real world analogy with creative emoji heading
HIDDEN SECTION 3 — Break into 3-5 parts with your own creative bold emoji headings
HIDDEN SECTION 4 — Give 3-5 real world examples under heading like "🌍 Where You See This in Real Life"
HIDDEN SECTION 5 — Summarize key points under heading like "✅ Quick Summary"
HIDDEN SECTION 6 — End with 3 follow up questions:

---
**Want to explore more? Here are some related topics you might find interesting:**

👉 1. [First related question]?
👉 2. [Second related question]?
👉 3. [Third related question]?

*Just type the number or ask me anything else — I'm here to help! 😊*

---

## FORMATTING RULES:
- Use **bold** for important terms and headings
- Use bullet points for lists
- Use numbered steps for processes
- Use relevant topic emojis on every heading
- Use proper code blocks for all code
- Keep paragraphs short — maximum 4 sentences each

## SAFETY RULES:
- Do not generate harmful, illegal, or dangerous content
- Do not promote violence, discrimination, or illegal activities
- Protect user privacy
- If a request is unsafe, politely refuse and explain why
"""

# This function decides if web search is needed
def needs_web_search(message):
    message_lower = message.lower()

    # Keywords that definitely need web search
    search_triggers = [
        # Current events
        "latest", "recent", "today", "yesterday", "this week",
        "this month", "this year", "right now", "currently", "news",
        "update", "new", "just", "announced", "released",

        # Specific entities
        "who is", "who are", "who was", "who owns", "who founded",
        "who created", "who started", "who invented", "who built",
        "what is the owner", "owner of", "founder of", "ceo of",
        "president of", "director of",

        # Company/business info
        "company", "startup", "business", "organization", "founded",
        "established", "started in", "headquarters", "office",
        "when was", "where is", "how many employees",

        # Prices and stats
        "price of", "cost of", "how much", "stock price",
        "exchange rate", "weather", "temperature",

        # Sports and entertainment
        "score", "match", "game", "won", "lost", "winner",
        "result", "movie release", "song", "album",

        # Location specific
        "in jaipur", "in delhi", "in mumbai", "in india",
        "near me", "location", "address", "contact",
    ]

    for trigger in search_triggers:
        if trigger in message_lower:
            return True

    return False


# This performs web search and formats results
def search_web(query):
    try:
        results = tavily_client.search(
            query=query,
            search_depth="advanced",
            max_results=5
        )

        # Format search results for AI
        formatted = "Here are the current web search results for your query:\n\n"

        for i, result in enumerate(results.get("results", []), 1):
            formatted += f"SOURCE {i}: {result.get('title', 'No title')}\n"
            formatted += f"URL: {result.get('url', '')}\n"
            formatted += f"CONTENT: {result.get('content', 'No content')}\n\n"

        formatted += "\nPlease use these search results to answer the user's question accurately."
        return formatted, results.get("results", [])

    except Exception as e:
        print("Search error:", str(e))
        return None, []


# MAIN CHAT ROUTE
@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.json
        user_message = data["message"]
        history = data.get("history", [])

        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        messages += history

        # Check if web search is needed
        search_results = []
        if needs_web_search(user_message):
            print(f"🔍 Searching web for: {user_message}")
            search_context, search_results = search_web(user_message)

            if search_context:
                # Add search results to the message
                enhanced_message = f"{user_message}\n\n{search_context}"
                messages.append({"role": "user", "content": enhanced_message})
            else:
                messages.append({"role": "user", "content": user_message})
        else:
            messages.append({"role": "user", "content": user_message})

        # Stream the response
        def generate():
            # First send search status if web search was used
            if search_results:
                yield f"data: {json.dumps({'searching': True})}\n\n"

            stream = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,
                temperature=0.7,
                max_tokens=2048,
                stream=True
            )

            for chunk in stream:
                token = chunk.choices[0].delta.content
                if token:
                    yield f"data: {json.dumps({'token': token})}\n\n"

            # Send sources at the end if web search was used
            if search_results:
                sources = []
                for r in search_results[:3]:
                    sources.append({
                        "title": r.get("title", "Source"),
                        "url": r.get("url", "")
                    })
                yield f"data: {json.dumps({'sources': sources})}\n\n"

            yield f"data: {json.dumps({'done': True})}\n\n"

        return Response(generate(), mimetype="text/event-stream")

    except Exception as e:
        print("ERROR:", str(e))
        return jsonify({"error": str(e)}), 500


# TITLE GENERATION ROUTE
@app.route("/generate-title", methods=["POST"])
def generate_title():
    try:
        data = request.json
        first_message = data["message"]

        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": "Generate a very short chat title (maximum 4 words) based on the user message. Return ONLY the title, nothing else. No quotes, no punctuation at the end. Examples: 'Python Calculator Code', 'What is AI', 'Solar System Explained'"
                },
                {
                    "role": "user",
                    "content": first_message
                }
            ],
            max_tokens=20,
            temperature=0.5
        )

        title = response.choices[0].message.content.strip()
        return jsonify({"title": title})

    except Exception as e:
        print("Title error:", str(e))
        return jsonify({"title": "New Chat"}), 500


# START SERVER
if __name__ == "__main__":
    app.run(debug=True)