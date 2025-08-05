import logging
from scripts.python.ai_summarizer import ReviewSummarizer
from scripts.python.review_analyzer import ReviewAnalyzer

def test_ai_summarizer():
    """
    Test the AI summarizer with reviews from a product.
    """
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    logger = logging.getLogger(__name__)
    logger.info("Testing AI summarizer with sample reviews")
    
    # Create sample reviews (same as in ai_summarizer.py)
    sample_reviews = [
        {
            'reviewer_name': "John Doe",
            'title': "Great product, highly recommend!",
            'rating': 5.0,
            'date': "January 1, 2023",
            'text': "This product exceeded my expectations. It's well-made, durable, and works exactly as described. I've been using it for a month now and have no complaints.",
            'verified_purchase': True,
            'helpful_votes': 10
        },
        {
            'reviewer_name': "Jane Smith",
            'title': "Good but could be better",
            'rating': 4.0,
            'date': "February 15, 2023",
            'text': "I like this product overall. It does what it's supposed to do, but there are a few minor issues. The instructions could be clearer, and it took me longer than expected to set up.",
            'verified_purchase': True,
            'helpful_votes': 5
        },
        {
            'reviewer_name': "Bob Johnson",
            'title': "Disappointed with quality",
            'rating': 2.0,
            'date': "March 10, 2023",
            'text': "I was excited to try this product, but I'm disappointed with the quality. It feels cheaply made and stopped working after just two weeks of light use. Not worth the price.",
            'verified_purchase': False,
            'helpful_votes': 8
        }
    ]
    
    # Create the summarizer
    summarizer = ReviewSummarizer()
    
    # Generate a summary
    logger.info("Generating summary from reviews")
    summary = summarizer.generate_summary(sample_reviews)
    
    # Highlight key points
    logger.info("Highlighting key points in reviews")
    highlighted_reviews = summarizer.highlight_key_points(sample_reviews)
    
    # Print results
    print("\n" + "="*50)
    print("AI-GENERATED REVIEW SUMMARY")
    print("="*50)
    print(f"\n{summary['summary']}")
    
    print("\n" + "="*50)
    print("KEY POINTS")
    print("="*50)
    for point in summary['key_points']:
        print(f"• {point}")
    
    print("\n" + "="*50)
    print("PROS & CONS")
    print("="*50)
    print("Pros:")
    for pro in summary['pros']:
        print(f"✓ {pro}")
    
    print("\nCons:")
    for con in summary['cons']:
        print(f"✗ {con}")
    
    print("\n" + "="*50)
    print(f"Overall Sentiment: {summary['sentiment'].capitalize()}")
    print("="*50)
    
    print("\n" + "="*50)
    print("HIGHLIGHTED REVIEWS")
    print("="*50)
    for i, review in enumerate(highlighted_reviews):
        print(f"Review #{i+1}: {review['title']} - {review['rating']} stars")
        print(f"Key point: {review['key_point']}")
        print("-" * 40)
    
    return summary, highlighted_reviews

def test_full_pipeline(product_url):
    """
    Test the full pipeline: scraping reviews from a product URL, analyzing them,
    and generating an AI summary.
    
    Args:
        product_url (str): URL of the Amazon product to analyze
    """
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    logger = logging.getLogger(__name__)
    logger.info(f"Testing full pipeline for product: {product_url}")
    
    # 1. Extract reviews from the product page
    logger.info("Step 1: Extracting reviews")
    review_analyzer = ReviewAnalyzer()
    reviews = review_analyzer.extract_reviews(product_url, max_pages=2)
    
    if not reviews:
        logger.warning("No reviews found for this product")
        print("\n" + "="*50)
        print("NO REVIEWS FOUND")
        print("="*50)
        print("Could not find any reviews for this product. Try another product URL.")
        return None, None
    
    # 2. Generate a summary using the AI summarizer
    logger.info(f"Step 2: Generating AI summary for {len(reviews)} reviews")
    summarizer = ReviewSummarizer()
    summary = summarizer.generate_summary(reviews)
    
    # 3. Find similar products
    logger.info("Step 3: Finding similar products")
    similar_products = review_analyzer.find_similar_products(product_url)
    
    # Print results
    print("\n" + "="*50)
    print("PRODUCT REVIEW SUMMARY")
    print("="*50)
    print(f"Found {len(reviews)} reviews")
    print(f"\n{summary['summary']}")
    
    print("\n" + "="*50)
    print("KEY POINTS")
    print("="*50)
    for point in summary['key_points']:
        print(f"• {point}")
    
    print("\n" + "="*50)
    print("PROS & CONS")
    print("="*50)
    print("Pros:")
    for pro in summary['pros']:
        print(f"✓ {pro}")
    
    print("\nCons:")
    for con in summary['cons']:
        print(f"✗ {con}")
    
    print("\n" + "="*50)
    print("SAMPLE REVIEWS (first 3)")
    print("="*50)
    for i, review in enumerate(reviews[:3]):
        print(f"Review #{i+1}: {review['title']} - {review['rating']} stars")
        print(f"Date: {review['date']} | Verified: {'Yes' if review['verified_purchase'] else 'No'}")
        
        # Truncate long review texts
        text = review['text']
        if len(text) > 200:
            text = text[:200] + "..."
        print(f"Text: {text}")
        print("-" * 40)
    
    print("\n" + "="*50)
    print("SIMILAR PRODUCTS")
    print("="*50)
    if similar_products:
        print(f"Found {len(similar_products)} similar products:")
        for i, product in enumerate(similar_products[:5]):
            print(f"{i+1}. {product['title']}")
            print(f"   URL: {product['url']}")
            print(f"   Price: {product['price_text']}")
            print()
    else:
        print("No similar products found.")
    
    return summary, reviews, similar_products

if __name__ == "__main__":
    # Test with sample reviews
    print("\n" + "="*50)
    print("TEST 1: USING SAMPLE REVIEWS")
    print("="*50)
    test_ai_summarizer()
    
    # Test with real product
    print("\n\n" + "="*50)
    print("TEST 2: FULL PIPELINE WITH REAL PRODUCT")
    print("="*50)
    
    # Amazon product URL for the Hawkins pressure cooker
    product_url = "https://www.amazon.com/HAWKIN-Classic-CL50-Improved-Aluminum-Pressure/dp/B00SX2YSMS"
    
    # Run the full pipeline test
    test_full_pipeline(product_url) 