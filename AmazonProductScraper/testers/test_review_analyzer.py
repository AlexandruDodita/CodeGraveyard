import logging
from scripts.python.review_analyzer import ReviewAnalyzer

def test_review_analyzer(url):
    """
    Test the ReviewAnalyzer class with a specific URL.
    
    Args:
        url (str): The URL of the Amazon product page to analyze.
    """
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    logger = logging.getLogger(__name__)
    logger.info(f"Testing ReviewAnalyzer with URL: {url}")
    
    # Create analyzer instance
    analyzer = ReviewAnalyzer()
    
    # Extract reviews (limit to 2 pages for testing)
    logger.info("Extracting reviews...")
    reviews = analyzer.extract_reviews(url, max_pages=2)
    
    # Analyze sentiment
    if reviews:
        logger.info(f"Analyzing sentiment for {len(reviews)} reviews...")
        analysis = analyzer.analyze_sentiment(reviews)
    else:
        logger.warning("No reviews found to analyze.")
        analysis = {
            'average_rating': 0,
            'total_reviews': 0,
            'rating_counts': {},
            'verified_count': 0,
            'verified_percentage': 0
        }
    
    # Find similar products
    logger.info("Finding similar products...")
    similar_products = analyzer.find_similar_products(url)
    
    # Print results
    print("\n" + "="*50)
    print("REVIEW ANALYSIS")
    print("="*50)
    print(f"Total reviews extracted: {len(reviews)}")
    print(f"Average rating: {analysis['average_rating']} stars")
    print("Rating distribution:")
    for star, count in analysis['rating_counts'].items():
        print(f"  {star}: {count} reviews")
    print(f"Verified purchases: {analysis['verified_count']} ({analysis['verified_percentage']}%)")
    
    print("\n" + "="*50)
    print("SAMPLE REVIEWS (first 3)")
    print("="*50)
    for i, review in enumerate(reviews[:3]):
        print(f"Review #{i+1}: {review['title']}")
        print(f"Rating: {review['rating']} stars | Date: {review['date']}")
        print(f"Verified: {'Yes' if review['verified_purchase'] else 'No'} | Helpful votes: {review['helpful_votes']}")
        
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
    
    return reviews, analysis, similar_products

if __name__ == "__main__":
    # The Amazon product URL for the HAWKIN Classic pressure cooker
    url = "https://www.amazon.com/HAWKIN-Classic-CL50-Improved-Aluminum-Pressure/dp/B00SX2YSMS"
    
    # Run the test
    test_review_analyzer(url) 