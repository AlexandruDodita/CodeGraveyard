#!/usr/bin/env python3
"""
DeepSeek API Script for Amazon Product Analysis
This script processes review.json and generates an AI analysis using DeepSeek API.
"""
import os
import json
import sys
from pathlib import Path
from openai import OpenAI
from dotenv import load_dotenv

# ============================================================
# API KEY CONFIGURATION
# Load environment variables from .env file
load_dotenv()
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
if DEEPSEEK_API_KEY:
    print(f"DEBUG: Loaded API key ending with: ...{DEEPSEEK_API_KEY[-4:]}")
else:
    print("DEBUG: DEEPSEEK_API_KEY not found in environment variables.")
# ============================================================

def load_review_data(filepath):
    """Load review data from JSON file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading review data: {e}")
        sys.exit(1)

def generate_mock_data():
    """Generate mock product data when review.json can't be loaded"""
    return {
        "product_details": {
            "description": "Sample Product",
            "price": "$99.99"
        },
        "review_data": {
            "reviews": [
                {"rating": 5.0, "text": "Great product, love it!"},
                {"rating": 4.0, "text": "Good product, but could be better."},
                {"rating": 3.0, "text": "Average product, nothing special."}
            ],
            "analysis": {
                "average_rating": 4.0,
                "total_reviews": 3
            }
        }
    }

def generate_prompt(data):
    """Generate a structured prompt from the review data"""
    product_title = data.get("product_details", {}).get("description", "").split("About this item")[0]
    if not product_title:
        product_title = "Unknown Product"
    
    product_price = data.get("product_details", {}).get("price", "Unknown")
    
    # Get review summary information
    avg_rating = data.get("review_data", {}).get("analysis", {}).get("average_rating", "Unknown")
    total_reviews = data.get("review_data", {}).get("analysis", {}).get("total_reviews", "Unknown")
    
    # Get up to 10 reviews for analysis
    reviews = data.get("review_data", {}).get("reviews", [])
    review_texts = []
    for review in reviews[:10]:
        review_texts.append(f"Rating: {review.get('rating')} - {review.get('text', '')}")
    
    # Compile prompt
    prompt = f"""
Product: {product_title}
Price: {product_price}
Average Rating: {avg_rating} from {total_reviews} reviews

REVIEWS:
{"\\n\\n".join(review_texts)}

Based on the above information, analyze this product:
1. Identify top strengths that should be highlighted in the listing
2. Define buyer personas who would value this product
3. Find negative trends with actionable fixes for the seller
4. Detect undocumented features customers appreciate
5. Extract standout quotes from reviews
"""
    return prompt

def get_deepseek_analysis(prompt):
    """Query DeepSeek API with the prompt"""
    client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url="https://api.deepseek.com")
    
    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": """You are an advanced assistant helping Amazon sellers optimize their product listings using customer reviews. Your job is to extract actionable, seller-focused insights based on review sentiment, trends, and buyer language.

Focus on surfacing what matters for:

    Optimizing bullet points and product descriptions

    Addressing buyer concerns and preemptive objections

    Highlighting competitive advantages based on real feedback

Return a structured JSON with the following schema:

{
  "top_strengths": [
    {
      "feature": "string (the praised feature)",
      "listing_advice": "string (how to phrase it in bullets or description)",
      "example_quote": "string (optional review excerpt to back it up)"
    }
  ],
  "buyer_personas": [
    {
      "persona": "string (short label, e.g., 'Remote Worker')",
      "description": "string (what this type of buyer values in the product)"
    }
  ],
  "negative_trends": [
    {
      "issue": "string (summarized recurring complaint)",
      "seller_fix": "string (how to fix it in listing, manual, or packaging)",
      "severity": "low | medium | high"
    }
  ],
  "undocumented_features": [
    {
      "feature": "string (unexpected but appreciated feature)",
      "quote": "string (short review quote showing this)"
    }
  ],
  "standout_quotes": [
    "string", "string", "string"
  ]
}

Be concise but specific. Use bullet-point logic, not narrative fluff.
Emphasize seller actionability over general sentiment.
If reviews contain contradictory opinions, indicate that subtly in your fields.
Prioritize information not already obvious in the current Amazon listing."""},
                {"role": "user", "content": prompt},
            ],
            stream=False
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error calling DeepSeek API: {e}")
        # Return a structured error response
        error_response = {
            "error": str(e),
            "message": "Failed to call DeepSeek API. Please check your API key and network connection.",
            "top_strengths": [],
            "buyer_personas": [],
            "negative_trends": [],
            "undocumented_features": [],
            "standout_quotes": []
        }
        return json.dumps(error_response)

def generate_mock_analysis():
    """Generate a mock analysis when API call fails"""
    mock_analysis = {
        "top_strengths": [
            {
                "feature": "Build quality",
                "listing_advice": "Highlight 'Durable construction with premium materials' in the first bullet point",
                "example_quote": "The keyboard has a solid construction despite being all plastic"
            }
        ],
        "buyer_personas": [
            {
                "persona": "Budget Gamer",
                "description": "Values performance and aesthetics at an affordable price point"
            }
        ],
        "negative_trends": [
            {
                "issue": "Software download confusion",
                "seller_fix": "Include clear URL to software downloads in product manual and packaging",
                "severity": "medium"
            }
        ],
        "undocumented_features": [
            {
                "feature": "Keyboard lighting controls",
                "quote": "FN+END pauses and unpauses breathing. FN+PGDN enables and disables the backlight entirely."
            }
        ],
        "standout_quotes": [
            "I can say with complete honesty, that I do not think you can find a better Mouse/Keyboard combo out there for the price",
            "This combo set delivers great performance and style at an affordable price"
        ]
    }
    return json.dumps(mock_analysis, indent=2)

def save_response(response, output_path):
    """Save the API response to a JSON file"""
    try:
        # Clean up markdown formatting if present
        cleaned_response = response
        if response.startswith("```json"):
            cleaned_response = response.replace("```json", "").replace("```", "").strip()
        elif response.startswith("```"):
            cleaned_response = response.replace("```", "").strip()
            
        # Attempt to parse the response as JSON
        try:
            response_json = json.loads(cleaned_response)
        except json.JSONDecodeError:
            # If the response isn't valid JSON, wrap it in a structure
            response_json = {
                "raw_response": response,
                "error": "Response was not valid JSON"
            }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(response_json, f, indent=2)
        print(f"Analysis saved to {output_path}")
    except Exception as e:
        print(f"Error saving response: {e}")

def main():
    # Define file paths
    script_dir = Path(__file__).parent.absolute()
    root_dir = script_dir.parent.parent
    review_json_path = root_dir / "review.json"
    response_json_path = root_dir / "response.json"
    
    # Check if API key is configured
    if not DEEPSEEK_API_KEY or DEEPSEEK_API_KEY == "your_api_key_here":
        print("WARNING: DEEPSEEK_API_KEY is not set or is still the default placeholder in your .env file.")
        print("Please create a .env file in the root directory and add your DeepSeek API key as DEEPSEEK_API_KEY=your_key_here.")
        print("The API call will likely fail without a valid API key.")
    
    # Load review data
    review_data = load_review_data(review_json_path)
    
    # Generate prompt
    prompt = generate_prompt(review_data)
    
    # Get analysis from DeepSeek
    analysis = get_deepseek_analysis(prompt)
    
    # Save response
    save_response(analysis, response_json_path)

if __name__ == "__main__":
    main()