#!/usr/bin/env python3
import argparse
import logging
import sys
import json
from typing import Dict, Any, List, Optional

from scripts.python.scraper import AmazonScraper, scrape_amazon_product
from scripts.python.review_analyzer import ReviewAnalyzer, analyze_product_reviews
from scripts.python.ai_summarizer import ReviewSummarizer, summarize_reviews

def setup_logging(verbose: bool = False) -> None:
    """Configure logging for the application."""
    log_level = logging.DEBUG if verbose else logging.INFO
    # Ensure the stream handler uses UTF-8 encoding
    handler = logging.StreamHandler(sys.stdout.buffer.write if hasattr(sys.stdout, 'buffer') else sys.stdout)
    handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
    
    # Get the root logger and remove existing handlers
    root_logger = logging.getLogger()
    if root_logger.hasHandlers():
        root_logger.handlers.clear()
        
    root_logger.addHandler(handler)
    root_logger.setLevel(log_level)

    # Also configure encoding for individual loggers if necessary, though root should cover it.
    logging.getLogger('scripts.python.scraper').setLevel(log_level)
    logging.getLogger('scripts.python.review_analyzer').setLevel(log_level)
    logging.getLogger('scripts.python.ai_summarizer').setLevel(log_level)

def extract_product_details(url: str) -> Dict[str, Any]:
    """Extract product description, specifications, image URL, and price."""
    description, specs, image_url, price = scrape_amazon_product(url)
    
    return {
        "description": description,
        "specifications": specs,
        "image_url": image_url,
        "price": price
    }

def extract_and_analyze_reviews(url: str, max_pages: int = 3) -> Dict[str, Any]:
    """Extract reviews and analyze them."""
    reviews, analysis = analyze_product_reviews(url, max_pages)
    
    return {
        "reviews": reviews,
        "analysis": analysis
    }

def find_similar_products(url: str) -> List[Dict[str, Any]]:
    """Find similar products listed on the product page."""
    analyzer = ReviewAnalyzer()
    return analyzer.find_similar_products(url)

def generate_ai_summary(reviews: List[Dict[str, Any]], api_key: Optional[str] = None) -> Dict[str, Any]:
    """Generate an AI-powered summary of the reviews."""
    return summarize_reviews(reviews, api_key)

def save_results_to_json(data: Dict[str, Any], output_file: str) -> None:
    """Save analysis results to a JSON file."""
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    logging.info(f"Results saved to {output_file}")

def safe_print(text: Any, end: str = '\n') -> None:
    """Safely print text to stdout, encoding to UTF-8 and handling errors."""
    try:
        # Ensure text is a string
        if not isinstance(text, str):
            text = str(text)
        
        # Encode to UTF-8 and decode back to handle potential errors in the string itself
        # Replace errors during encoding to prevent crashes
        encoded_text = text.encode('utf-8', errors='replace').decode('utf-8', errors='replace')
        
        if hasattr(sys.stdout, 'buffer'):
            sys.stdout.buffer.write(encoded_text.encode('utf-8') + end.encode('utf-8'))
            sys.stdout.flush() # Ensure it's written immediately
        else:
            # Fallback for environments without sys.stdout.buffer (less likely for Node.js child process)
            print(encoded_text, end=end)
            sys.stdout.flush()

    except Exception as e:
        # Fallback: print a representation or a placeholder if encoding fails
        try:
            print(repr(text) + " (print error: " + str(e) + ")", end=end)
            sys.stdout.flush()
        except:
            # Ultimate fallback
            print(f"[Unprintable text - Error: {e}]", end=end)
            sys.stdout.flush()

def print_summary(data: Dict[str, Any]) -> None:
    """Print a summary of the analysis results to the console."""
    safe_print("\n" + "="*80)
    safe_print("AMAZON PRODUCT SUMMARY")
    safe_print("="*80)
    
    # Product information
    if "product_details" in data:
        specs = data["product_details"].get("specifications", {})
        product_brand = specs.get('Brand', '')
        product_title_spec = specs.get('Title', '') # Assuming 'Title' might be in specs
        
        # Attempt to get a more descriptive title if 'Title' spec is empty
        product_name_display = f"{product_brand} {product_title_spec}".strip()
        if not product_name_display and data["product_details"].get("description"):
            # Fallback to first part of description if available
            desc_parts = data["product_details"]["description"].split('.')[0]
            product_name_display = desc_parts.split('-')[0].strip()
            if len(product_name_display) > 70: # Keep it concise
                 product_name_display = product_name_display[:67] + "..."
        elif not product_name_display:
            product_name_display = "N/A"

        safe_print(f"\nProduct: {product_name_display}")
        safe_print(f"ASIN: {specs.get('ASIN', 'Unknown')}")
        
        # Print price if available
        if data["product_details"].get("price"):
            safe_print(f"Price: {data['product_details']['price']}")
        
        # Print image URL if available
        if data["product_details"].get("image_url"):
            safe_print(f"Image URL: {data['product_details']['image_url']}")
        
        # Print a few key specifications
        important_specs = ["Brand", "Capacity", "Material", "Color", "Product Dimensions", "Item Weight"]
        safe_print("\nSpecifications:")
        found_any_specs = False
        for spec_name in important_specs:
            if spec_name in specs and specs[spec_name] is not None: # Check if spec exists and is not None
                safe_print(f"  {spec_name}: {specs[spec_name]}")
                found_any_specs = True
        if not found_any_specs:
            safe_print("  No key specifications listed.")

    # Review analysis
    if "review_data" in data and "analysis" in data["review_data"]:
        analysis = data["review_data"]["analysis"]
        safe_print(f"\nTotal Reviews: {analysis.get('total_reviews', 0)}")
        safe_print(f"Average Rating: {analysis.get('average_rating', 0)} stars")
        
        # Rating distribution
        if "rating_counts" in analysis:
            safe_print("\nRating Distribution:")
            for star, count in analysis["rating_counts"].items():
                safe_print(f"  {star}: {count} reviews")
        
        # Top positive reviews
        if "top_positive_reviews" in analysis and analysis["top_positive_reviews"]:
            safe_print("\n" + "-"*80)
            safe_print("TOP POSITIVE REVIEWS")
            safe_print("-"*80)
            for i, review in enumerate(analysis["top_positive_reviews"], 1):
                safe_print(f"{i}. {review.get('title', 'N/A')} - {review.get('rating', 'N/A')} stars")
                safe_print(f"   By: {review.get('reviewer_name', 'Anonymous')} | Date: {review.get('date', 'Unknown')}")
                safe_print(f"   Verified Purchase: {'Yes' if review.get('verified_purchase') else 'No'} | Helpful Votes: {review.get('helpful_votes', 0)}")
                
                text = review.get('text', '')
                if len(text) > 150:
                    text = text[:150] + "..."
                safe_print(f"   {text}")
                safe_print("") # Empty line for spacing
        
        # Top negative reviews
        if "top_negative_reviews" in analysis and analysis["top_negative_reviews"]:
            safe_print("\n" + "-"*80)
            safe_print("TOP NEGATIVE REVIEWS")
            safe_print("-"*80)
            for i, review in enumerate(analysis["top_negative_reviews"], 1):
                safe_print(f"{i}. {review.get('title', 'N/A')} - {review.get('rating', 'N/A')} stars")
                safe_print(f"   By: {review.get('reviewer_name', 'Anonymous')} | Date: {review.get('date', 'Unknown')}")
                safe_print(f"   Verified Purchase: {'Yes' if review.get('verified_purchase') else 'No'} | Helpful Votes: {review.get('helpful_votes', 0)}")
                
                text = review.get('text', '')
                if len(text) > 150:
                    text = text[:150] + "..."
                safe_print(f"   {text}")
                safe_print("") # Empty line for spacing
    
    # AI summary
    if "ai_summary" in data:
        summary = data["ai_summary"]
        safe_print("\n" + "-"*80)
        safe_print("AI-GENERATED REVIEW SUMMARY")
        safe_print("-"*80)
        safe_print(f"\n{summary.get('summary', 'No summary available.')}")
        
        # Key points
        if "key_points" in summary and summary["key_points"]:
            safe_print("\nKey Points:")
            for point in summary["key_points"]:
                safe_print(f"• {point}")
        
        # Pros and cons
        if "pros" in summary and summary["pros"]:
            safe_print("\nPros:")
            for pro in summary["pros"]:
                safe_print(f"✓ {pro}")
        
        if "cons" in summary and summary["cons"]:
            safe_print("\nCons:")
            for con in summary["cons"]:
                safe_print(f"✗ {con}")
    
    # Similar products
    if "similar_products" in data and data["similar_products"]:
        safe_print("\n" + "-"*80)
        safe_print("SIMILAR PRODUCTS")
        safe_print("-"*80)
        for i, product in enumerate(data["similar_products"][:5], 1): # Limit to top 5
            safe_print(f"{i}. {product.get('title', 'Unknown')}")
            safe_print(f"   URL: {product.get('url', '')}")
            if product.get('price'): # Changed from 'price_text' to 'price' based on review.json
                safe_print(f"   Price: {product['price']}")
            safe_print("") # Empty line for spacing
    
    safe_print("="*80)

def process_product(url: str, output_file: Optional[str] = None, 
                   max_review_pages: int = 3, api_key: Optional[str] = None,
                   skip_similar: bool = False, verbose: bool = False) -> Dict[str, Any]:
    """
    Process a product URL and perform all analyses.
    
    Args:
        url (str): The Amazon product URL
        output_file (str, optional): Path to save results as JSON
        max_review_pages (int): Maximum number of review pages to scrape
        api_key (str, optional): API key for AI service
        skip_similar (bool): Skip finding similar products
        verbose (bool): Enable verbose logging
        
    Returns:
        Dict[str, Any]: Complete analysis results
    """
    # Setup logging
    setup_logging(verbose)
    
    logging.info(f"Processing Amazon product: {url}")
    
    # Create the result dictionary
    result = {
        "url": url,
        "product_details": {},
        "review_data": {},
        "ai_summary": {},
        "similar_products": []
    }
    
    # 1. Extract product details
    logging.info("Step 1: Extracting product details")
    try:
        result["product_details"] = extract_product_details(url)
        logging.info("Product details extracted successfully")
    except Exception as e:
        logging.error(f"Error extracting product details: {str(e)}")
    
    # 2. Extract and analyze reviews
    logging.info("Step 2: Extracting and analyzing reviews")
    try:
        result["review_data"] = extract_and_analyze_reviews(url, max_pages=max_review_pages)
        logging.info(f"Extracted {len(result['review_data'].get('reviews', []))} reviews")
    except Exception as e:
        logging.error(f"Error extracting reviews: {str(e)}")
    
    # 3. Generate AI summary if we have reviews
    if result["review_data"].get("reviews"):
        logging.info("Step 3: Generating AI summary")
        try:
            result["ai_summary"] = generate_ai_summary(
                result["review_data"]["reviews"], 
                api_key=api_key
            )
            logging.info("AI summary generated successfully")
        except Exception as e:
            logging.error(f"Error generating AI summary: {str(e)}")
    
    # 4. Find similar products if not skipped
    if not skip_similar:
        logging.info("Step 4: Finding similar products")
        try:
            result["similar_products"] = find_similar_products(url)
            logging.info(f"Found {len(result['similar_products'])} similar products")
        except Exception as e:
            logging.error(f"Error finding similar products: {str(e)}")
    
    # Save results if output file is specified
    if output_file:
        try:
            save_results_to_json(result, output_file)
        except Exception as e:
            logging.error(f"Error saving results: {str(e)}")
    
    # Print summary
    print_summary(result)
    
    return result

def main():
    """Main entry point of the application."""
    parser = argparse.ArgumentParser(
        description="Amazon Product Review Aggregator & Summarizer",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    
    parser.add_argument(
        "url",
        help="Amazon product URL to analyze"
    )
    
    parser.add_argument(
        "-o", "--output",
        help="Save results to this JSON file",
        default=None
    )
    
    parser.add_argument(
        "-p", "--pages",
        help="Maximum number of review pages to scrape",
        type=int,
        default=3
    )
    
    parser.add_argument(
        "-k", "--api-key",
        help="API key for AI service",
        default=None
    )
    
    parser.add_argument(
        "--skip-similar",
        help="Skip finding similar products",
        action="store_true"
    )
    
    parser.add_argument(
        "-v", "--verbose",
        help="Enable verbose logging",
        action="store_true"
    )
    
    args = parser.parse_args()
    
    try:
        # Process the product
        process_product(
            url=args.url,
            output_file=args.output,
            max_review_pages=args.pages,
            api_key=args.api_key,
            skip_similar=args.skip_similar,
            verbose=args.verbose
        )
    except KeyboardInterrupt:
        logging.info("Process interrupted by user")
        sys.exit(1)
    except Exception as e:
        logging.error(f"Unexpected error: {str(e)}")
        sys.exit(1)
    
    sys.exit(0)

if __name__ == "__main__":
    main() 