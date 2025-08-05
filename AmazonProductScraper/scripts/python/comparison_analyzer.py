"""
Amazon Product Comparison Analyzer
Runs DeepSeek comparison analysis on two Amazon products
"""

import os
import sys
import json
import time
import requests
from pathlib import Path
from dotenv import load_dotenv

# Get the directory of this script
script_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(script_dir, '../..'))

# Define file paths
comparison_data_path = os.path.join(script_dir, '../comparison_data.json')
comparison_prompt_path = os.path.join(script_dir, '../comparison_prompt.txt')
comparison_result_path = os.path.join(script_dir, '../comparison_result.json')

# DeepSeek API configuration
load_dotenv(os.path.join(root_dir, '.env'))
API_KEY = os.environ.get('DEEPSEEK_API_KEY')

if API_KEY:
    print(f"DEBUG (comparison_analyzer.py): Loaded API key ending with: ...{API_KEY[-4:]}")
else:
    print("DEBUG (comparison_analyzer.py): DEEPSEEK_API_KEY not found in environment variables.")

API_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions'

def read_comparison_data():
    """Read the comparison data from the JSON file"""
    try:
        with open(comparison_data_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error reading comparison data: {e}")
        return None

def read_comparison_prompt():
    """Read the comparison prompt from the text file"""
    try:
        with open(comparison_prompt_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        print(f"Error reading comparison prompt: {e}")
        return None

def generate_comparison_prompt(product_a, product_b):
    """Generate a comparison prompt for DeepSeek"""
    
    # Extract key details from both products
    product_a_details = product_a.get('product_details', {})
    product_a_reviews = product_a.get('review_data', {}).get('reviews', [])
    product_a_analysis = product_a.get('review_data', {}).get('analysis', {})
    
    product_b_details = product_b.get('product_details', {})
    product_b_reviews = product_b.get('review_data', {}).get('reviews', [])
    product_b_analysis = product_b.get('review_data', {}).get('analysis', {})
    
    # Create a structured prompt with the comparison schema
    prompt = """
You are an intelligent assistant comparing two similar Amazon products based on customer feedback and product data. Your goal is to extract clear, actionable differences that help a seller:

    Position their product better
    Understand competitive weaknesses
    Identify features to emphasize, improve, or de-emphasize

Output a structured JSON with the following schema:
{
  "product_advantages": [
    {
      "feature": "string (e.g., 'Battery Life')",
      "better_product": "A or B",
      "summary": "string (why this product wins here)",
      "quote": "string (optional review quote that supports it)"
    }
  ],
  "critical_weaknesses": [
    {
      "feature": "string (e.g., 'Build Quality')",
      "worse_product": "A or B",
      "issue": "string (what customers complained about)",
      "severity": "low | medium | high"
    }
  ],
  "shared_strengths": [
    "string", "string", "string"
  ],
  "unique_selling_points": {
    "product_A": [
      "string (selling point unique to A)"
    ],
    "product_B": [
      "string (selling point unique to B)"
    ]
  },
  "buyer_recommendation": "string (short recommendation on which buyer would prefer A vs B, with reasoning)"
}

Focus on what matters to buyers, not spec-sheet trivia.
Use review-backed insights, not assumptions.
Be blunt but fair. If one product clearly wins on something, say it.
If a product is better for a certain audience or use case, highlight that in the buyer_recommendation.

Here are the details for Product A:
Title: {product_a_title}
Price: {product_a_price}
Rating: {product_a_rating}/5 ({product_a_review_count} reviews)
Description: {product_a_description}

Here are some reviews for Product A:
{product_a_reviews}

Here are the details for Product B:
Title: {product_b_title}
Price: {product_b_price}
Rating: {product_b_rating}/5 ({product_b_review_count} reviews)
Description: {product_b_description}

Here are some reviews for Product B:
{product_b_reviews}

Compare these products and provide your analysis as the JSON schema shown above.
""".format(
        product_a_title=product_a_details.get('description', 'Unknown Product A'),
        product_a_price=product_a_details.get('price', 'Unknown Price'),
        product_a_rating=product_a_analysis.get('average_rating', 0),
        product_a_review_count=product_a_analysis.get('total_reviews', 0),
        product_a_description=product_a_details.get('description', 'No description available'),
        product_a_reviews=format_reviews(product_a_reviews[:8]),  # Limit to 8 reviews to avoid token limits
        
        product_b_title=product_b_details.get('description', 'Unknown Product B'),
        product_b_price=product_b_details.get('price', 'Unknown Price'),
        product_b_rating=product_b_analysis.get('average_rating', 0),
        product_b_review_count=product_b_analysis.get('total_reviews', 0),
        product_b_description=product_b_details.get('description', 'No description available'),
        product_b_reviews=format_reviews(product_b_reviews[:8])  # Limit to 8 reviews to avoid token limits
    )
    
    return prompt

def format_reviews(reviews):
    """Format reviews for the prompt"""
    formatted_reviews = ""
    for i, review in enumerate(reviews, 1):
        rating = review.get('rating', 'Unknown Rating')
        title = review.get('title', 'No Title')
        content = review.get('content', 'No Content')
        
        formatted_reviews += f"Review {i}:\n"
        formatted_reviews += f"Rating: {rating}/5\n"
        formatted_reviews += f"Title: {title}\n"
        formatted_reviews += f"Content: {content}\n\n"
    
    return formatted_reviews

def call_deepseek_api(prompt):
    """Call the DeepSeek API with the given prompt"""
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {API_KEY}'
    }
    
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": "You are a helpful assistant that analyzes Amazon products and compares them accurately. Always respond with valid JSON as instructed."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.3,  # Lower temperature for more consistent results
        "max_tokens": 3000
    }
    
    try:
        response = requests.post(API_ENDPOINT, headers=headers, json=payload)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error calling DeepSeek API: {e}")
        if hasattr(e, 'response') and hasattr(e.response, 'text'):
            print(f"Response: {e.response.text}")
        return None

def extract_json_from_response(response):
    """Extract JSON from the DeepSeek API response"""
    if not response or 'choices' not in response:
        return None
    
    try:
        content = response['choices'][0]['message']['content']
        
        # Extract JSON from the response
        # Try to find JSON between code blocks first
        import re
        json_match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
        if json_match:
            json_str = json_match.group(1)
        else:
            # If no code blocks, try to parse the whole content
            json_str = content
        
        # Clean up any markdown or text around the JSON
        json_str = json_str.replace('```json', '').replace('```', '')
        
        return json.loads(json_str)
    except Exception as e:
        print(f"Error extracting JSON from response: {e}")
        print(f"Response content: {content}")
        return None

def main():
    """Main function to run the comparison analysis"""
    print("Starting comparison analysis...")
    
    # Check if API key is configured
    if not API_KEY:
        print("ERROR: DEEPSEEK_API_KEY is not set. Please ensure it's in your .env file.")
        print("The API call will fail without a valid API key.")
        # Optionally, exit if no API key, or rely on the call_deepseek_api to fail
        # For now, we'll let it proceed to show the API call failure if it occurs
        # return 1 # Uncomment to exit early if API key is missing

    # Read the comparison data
    comparison_data = read_comparison_data()
    if comparison_data:
        product_a = comparison_data.get('product_A')
        product_b = comparison_data.get('product_B')
        
        if not product_a or not product_b:
            print("Error: Missing product data")
            return 1
        
        # Read the comparison prompt if it exists
        prompt = read_comparison_prompt()
        if not prompt:
            # If no prompt found, generate one
            prompt = generate_comparison_prompt(product_a, product_b)
    else:
        print("Error: No comparison data found")
        return 1
    
    # Save the prompt for debugging
    with open(comparison_prompt_path, 'w', encoding='utf-8') as f:
        f.write(prompt)
    
    # Call the DeepSeek API
    api_response = call_deepseek_api(prompt)
    if not api_response:
        print("Error: Failed to get response from DeepSeek API")
        return 1
    
    # Extract the JSON from the response
    result = extract_json_from_response(api_response)
    if not result:
        print("Error: Failed to extract JSON from response")
        return 1
    
    # Save the result
    with open(comparison_result_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2)
    
    print("Comparison analysis completed successfully!")
    print(f"Result saved to: {comparison_result_path}")
    return 0

if __name__ == "__main__":
    sys.exit(main()) 