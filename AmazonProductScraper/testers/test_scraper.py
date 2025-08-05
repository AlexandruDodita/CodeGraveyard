import sys
import logging
from scripts.python.scraper import AmazonScraper

def test_amazon_scraper(url):
    """
    Test the AmazonScraper class with a specific URL.
    
    Args:
        url (str): The URL of the Amazon product page to scrape.
    """
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    logger = logging.getLogger(__name__)
    logger.info(f"Testing AmazonScraper with URL: {url}")
    
    # Create scraper instance
    scraper = AmazonScraper()
    
    # Scrape the product
    logger.info("Starting scrape process...")
    description, specs, image_url, price = scraper.scrape_product(url)
    
    # Output results
    print("\n" + "="*50)
    print("PRODUCT DESCRIPTION")
    print("="*50)
    if description:
        print(description)
    else:
        print("No description found.")
    
    print("\n" + "="*50)
    print("TECHNICAL SPECIFICATIONS")
    print("="*50)
    if specs:
        for key, value in specs.items():
            print(f"{key}: {value}")
    else:
        print("No specifications found.")
    
    print("\n" + "="*50)
    print("PRODUCT IMAGE URL")
    print("="*50)
    if image_url:
        print(image_url)
    else:
        print("No image URL found.")
        
    print("\n" + "="*50)
    print("PRODUCT PRICE")
    print("="*50)
    if price:
        print(price)
    else:
        print("No price found.")
    
    return description, specs, image_url, price

if __name__ == "__main__":
    # The Amazon product URL for the HAWKIN Classic pressure cooker
    url = "https://www.amazon.com/HAWKIN-Classic-CL50-Improved-Aluminum-Pressure/dp/B00SX2YSMS"
    
    # Run the test
    test_amazon_scraper(url) 