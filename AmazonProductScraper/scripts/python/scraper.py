import requests
from bs4 import BeautifulSoup
import re
from typing import Dict, Optional, Tuple, Any, List
import logging
import random
import time

class AmazonScraper:
    """
    A class to scrape product information from Amazon product pages.
    Extracts product descriptions and technical specifications.
    """
    
    def __init__(self, user_agent: str = None):
        """
        Initialize the scraper with optional custom user agent.
        
        Args:
            user_agent (str, optional): Custom User-Agent header for HTTP requests.
        """
        self.session = requests.Session()
        
        # List of common user agents to rotate through
        user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:97.0) Gecko/20100101 Firefox/97.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.3 Safari/605.1.15',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.51 Safari/537.36 Edg/99.0.1150.30',
        ]
        
        default_ua = user_agent if user_agent else random.choice(user_agents)
        
        self.session.headers.update({
            'User-Agent': default_ua,
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0',
        })
        self.logger = logging.getLogger(__name__)
    
    def fetch_page(self, url: str, max_retries: int = 3) -> Optional[str]:
        """
        Fetch the HTML content of a given URL with retries.
        
        Args:
            url (str): The URL of the Amazon product page.
            max_retries (int): Maximum number of retry attempts.
            
        Returns:
            Optional[str]: HTML content of the page or None if request failed.
        """
        # Clean up URL to remove tracking parameters
        cleaned_url = self._clean_amazon_url(url)
        self.logger.info(f"Fetching page: {cleaned_url}")
        
        for attempt in range(max_retries):
            try:
                # Add a small delay between retries to avoid rate limiting
                if attempt > 0:
                    time.sleep(2 * attempt)
                
                # Add a random delay to appear more human-like
                time.sleep(random.uniform(0.5, 2.0))
                
                response = self.session.get(cleaned_url, timeout=30)
                response.raise_for_status()
                
                # Debug info about the response
                self.logger.info(f"Response status: {response.status_code}, Content length: {len(response.text)}")
                
                # Check if we got a CAPTCHA page
                if "captcha" in response.text.lower() or "robot check" in response.text.lower():
                    self.logger.warning("Amazon CAPTCHA detected. Request was blocked.")
                    continue
                
                return response.text
            except requests.RequestException as e:
                self.logger.error(f"Error fetching URL (attempt {attempt+1}/{max_retries}): {str(e)}")
                if attempt == max_retries - 1:
                    return None
        
        return None
    
    def _clean_amazon_url(self, url: str) -> str:
        """
        Clean Amazon URL by removing tracking and unnecessary parameters.
        
        Args:
            url (str): The original Amazon URL.
            
        Returns:
            str: Cleaned URL.
        """
        # Extract the ASIN if present
        asin_match = re.search(r'/dp/([A-Z0-9]{10})', url)
        if asin_match:
            asin = asin_match.group(1)
            # Create a clean URL with just the ASIN
            return f"https://www.amazon.com/dp/{asin}"
        
        # If no ASIN found, just return the original URL
        return url
    
    def extract_product_description(self, html_content: str) -> Optional[str]:
        """
        Extract the product description from the HTML.
        
        Args:
            html_content (str): HTML content of the product page.
            
        Returns:
            Optional[str]: Cleaned product description or None if not found.
        """
        if not html_content:
            return None
            
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Try multiple possible selectors for the product description
        desc_selectors = [
            "#productDescription_feature_div #productDescription",
            "#productDescription",
            "#feature-bullets",  # Sometimes description is in bullet points
            ".a-section.a-spacing-medium.a-spacing-top-small",  # Another common location
            "#dpx-aplus-product-description_feature_div",
            "#aplus_feature_div",
            "#aplus",
            "#dpx-product-description_feature_div",
            "#descriptionAndDetails",
            ".a-section.a-spacing-extra-large > .a-section"
        ]
        
        for selector in desc_selectors:
            try:
                desc_element = soup.select_one(selector)
                if desc_element:
                    # Clean the text
                    text = desc_element.get_text(strip=True)
                    # Replace multiple whitespaces with a single space
                    text = re.sub(r'\s+', ' ', text)
                    if text:
                        self.logger.info(f"Found description using selector: {selector}")
                        return text
            except Exception as e:
                self.logger.warning(f"Error extracting with selector {selector}: {str(e)}")
                continue
        
        # Try to extract feature bullets as a fallback for description
        features = self.extract_feature_bullets(soup)
        if features:
            return "Features: " + " | ".join(features)
                
        return None
    
    def extract_feature_bullets(self, soup) -> List[str]:
        """
        Extract feature bullets from the product page.
        
        Args:
            soup: BeautifulSoup object of the page.
            
        Returns:
            List[str]: List of feature bullet points.
        """
        features = []
        
        # Try multiple possible selectors for feature bullets
        bullet_selectors = [
            "#feature-bullets ul li:not(.aok-hidden) .a-list-item",
            "#feature-bullets ul li span.a-list-item",
            "#feature-bullets .a-list-item",
            ".a-unordered-list .a-list-item",
            "#feature-bullets ul li",
            ".a-section.a-spacing-medium .a-unordered-list li"
        ]
        
        for selector in bullet_selectors:
            try:
                bullets = soup.select(selector)
                if bullets:
                    for bullet in bullets:
                        text = bullet.get_text(strip=True)
                        if text and "Add to your order" not in text and len(text) > 5:
                            features.append(text)
                    
                    if features:
                        self.logger.info(f"Found {len(features)} feature bullets using selector: {selector}")
                        return features
            except Exception as e:
                self.logger.warning(f"Error extracting features with selector {selector}: {str(e)}")
                continue
                
        return features
    
    def extract_tech_specs(self, html_content: str) -> Dict[str, Any]:
        """
        Extract technical specifications from the product details table.
        
        Args:
            html_content (str): HTML content of the product page.
            
        Returns:
            Dict[str, Any]: Dictionary of technical specifications.
        """
        if not html_content:
            return {}
            
        soup = BeautifulSoup(html_content, 'html.parser')
        specs = {}
        
        # First try to extract from the product information section (table format)
        specs = self._extract_from_tables(soup)
        if specs:
            return specs
        
        # Then try to extract from bullet format if table format didn't work
        specs = self._extract_from_bullets(soup)
        if specs:
            return specs
        
        # Finally, try to extract from the about this item section
        specs = self._extract_from_about_section(soup)
            
        return specs
    
    def _extract_from_tables(self, soup) -> Dict[str, Any]:
        """Extract specs from various table formats on Amazon."""
        specs = {}
        
        # Try multiple possible selectors for the tech specs table
        table_selectors = [
            "#productDetails_detailBullets_section1",
            "#productDetails table",
            "#technicalSpecifications_section_1",
            "#detailBulletsWrapper_feature_div",
            "#prodDetails table",
            ".a-keyvalue.prodDetTable",
            "#technicalSpecifications_feature_div table",
            ".a-section.a-spacing-small table",
            "#detailBullets_feature_div"
        ]
        
        for selector in table_selectors:
            try:
                table = soup.select_one(selector)
                if table:
                    # Handle standard table format
                    rows = table.select("tr")
                    for row in rows:
                        # Get header/key cells
                        header_cell = row.select_one("th") or row.select_one(".a-span3")
                        # Get value cells
                        value_cell = row.select_one("td") or row.select_one(".a-span9")
                        
                        if header_cell and value_cell:
                            key = header_cell.get_text(strip=True).rstrip(':')
                            value = value_cell.get_text(strip=True)
                            
                            # Clean the text
                            key = re.sub(r'\s+', ' ', key)
                            value = re.sub(r'\s+', ' ', value)
                            
                            # Skip if the key and value are identical (likely an extraction error)
                            if key == value:
                                self.logger.warning(f"Skipping duplicate key/value: '{key}'")
                                continue
                                
                            # Also skip if value appears to be a header itself
                            if value.endswith(':') or value.strip() == "":
                                self.logger.warning(f"Skipping likely invalid value for '{key}'")
                                continue
                                
                            specs[key] = value
                    
                    if specs:
                        self.logger.info(f"Found {len(specs)} specifications using table selector: {selector}")
                        return specs
            except Exception as e:
                self.logger.warning(f"Error extracting with table selector {selector}: {str(e)}")
                continue
        
        return specs
    
    def _extract_from_bullets(self, soup) -> Dict[str, Any]:
        """Extract specs from bullet list format."""
        specs = {}
        
        try:
            # Try the bullet list format (alternative format Amazon sometimes uses)
            bullet_selectors = [
                "#detailBulletsWrapper_feature_div",
                "#detailBullets_feature_div",
                ".detail-bullets-wrapper"
            ]
            
            for selector in bullet_selectors:
                detail_bullets = soup.select_one(selector)
                if detail_bullets:
                    bullet_items = detail_bullets.select("li") or detail_bullets.select(".a-list-item")
                    for item in bullet_items:
                        text = item.get_text(strip=True)
                        # Match patterns like "Key : Value" or "Key: Value"
                        match = re.search(r'([^:]+):\s*(.*)', text)
                        if match:
                            key, value = match.groups()
                            key = key.strip()
                            value = value.strip()
                            
                            # Skip if the key and value are identical or if value is empty
                            if key == value or not value:
                                self.logger.warning(f"Skipping duplicate key/value: '{key}'")
                                continue
                                
                            # Skip if value appears to be a header itself 
                            if value.endswith(':') or value.strip() == "":
                                self.logger.warning(f"Skipping likely invalid value for '{key}'")
                                continue
                                
                            if key and value:
                                specs[key] = value
                    
                    if specs:
                        self.logger.info(f"Found {len(specs)} specifications using bullet selector: {selector}")
                        return specs
        except Exception as e:
            self.logger.warning(f"Error extracting from bullet format: {str(e)}")
        
        return specs
    
    def _extract_from_about_section(self, soup) -> Dict[str, Any]:
        """Extract details from the 'About this item' section."""
        specs = {}
        
        try:
            # Try to find the "About this item" section
            about_selectors = [
                "#feature-bullets",
                ".a-section:contains('About this item')",
                "#launchpad-product-description-feature-div",
                "#productDescription",
                "#aplusBtfContent"
            ]
            
            for selector in about_selectors:
                about_section = None
                
                if ":contains" in selector:
                    # Handle custom selector with :contains
                    section_name, search_text = selector.split(":contains")
                    search_text = search_text.strip("()'\"")
                    for section in soup.select(section_name):
                        if search_text in section.get_text():
                            about_section = section
                            break
                else:
                    about_section = soup.select_one(selector)
                
                if about_section:
                    # Try to find the title itself
                    title_element = about_section.find(lambda tag: tag.name in ['h1', 'h2', 'h3', 'h4', 'h5'] and 
                                                      'about this item' in tag.get_text().lower())
                    
                    # If found title, look for the list after it
                    if title_element:
                        list_element = title_element.find_next('ul')
                        if list_element:
                            bullets = list_element.select('li')
                            specs['About This Item'] = [bullet.get_text(strip=True) for bullet in bullets]
                            return specs
                    
                    # If we couldn't find the title or list that way, just extract all bullet points
                    bullets = about_section.select('li')
                    if bullets:
                        specs['About This Item'] = [bullet.get_text(strip=True) for bullet in bullets 
                                                    if len(bullet.get_text(strip=True)) > 5]
                        if specs['About This Item']:
                            self.logger.info(f"Found {len(specs['About This Item'])} items in About section using selector: {selector}")
                            return specs
        except Exception as e:
            self.logger.warning(f"Error extracting from About This Item section: {str(e)}")
        
        return specs
    
    def extract_product_image(self, html_content: str) -> Optional[str]:
        """
        Extract the main product image URL from the HTML.
        
        Args:
            html_content (str): HTML content of the product page.
            
        Returns:
            Optional[str]: URL of the main product image or None if not found.
        """
        if not html_content:
            return None
            
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Try multiple possible selectors for the main product image
        image_selectors = [
            "#landingImage",  # Most common location
            "#imgBlkFront",   # Common for books
            "#main-image",    # Another common selector
            ".a-dynamic-image#main-image",
            "#imageBlock_feature_div img",
            "#mainImageContainer img",
            "#ebooksImgBlkFront",
            "#image-block-container img",
            "#img-wrapper img",
            "#main-image-container img"
        ]
        
        for selector in image_selectors:
            try:
                img_element = soup.select_one(selector)
                if img_element:
                    # Try different attributes where the image URL might be found
                    for attr in ['data-old-hires', 'data-a-dynamic-image', 'src', 'data-zoom-image', 'data-src']:
                        img_url = img_element.get(attr)
                        if img_url:
                            # For data-a-dynamic-image, it's a JSON string with URLs
                            if attr == 'data-a-dynamic-image':
                                import json
                                try:
                                    img_json = json.loads(img_url)
                                    # Get the URL with the highest resolution
                                    img_url = list(img_json.keys())[0]
                                except:
                                    continue
                                
                            # Make sure we have a full URL
                            if img_url.startswith('//'):
                                img_url = f"https:{img_url}"
                                
                            self.logger.info(f"Found product image using selector: {selector}")
                            return img_url
            except Exception as e:
                self.logger.warning(f"Error extracting image with selector {selector}: {str(e)}")
                continue
                
        # Try to find in the image carousel if direct selectors didn't work
        try:
            carousel = soup.select_one('#imageBlock') or soup.select_one('#altImages')
            if carousel:
                all_images = carousel.select('img')
                for img in all_images:
                    if img.get('src') and not 'sprite' in img.get('src'):
                        img_url = img.get('src')
                        # Replace thumbnail URL with full-sized image URL
                        img_url = re.sub(r'._S[X0-9]+_\.', '.', img_url)
                        return img_url
        except Exception as e:
            self.logger.warning(f"Error extracting image from carousel: {str(e)}")
                
        return None
    
    def extract_product_price(self, html_content: str) -> Optional[str]:
        """
        Extract the product price from the HTML.
        
        Args:
            html_content (str): HTML content of the product page.
            
        Returns:
            Optional[str]: Product price as a string or None if not found.
        """
        if not html_content:
            return None
            
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Try multiple possible selectors for the price
        price_selectors = [
            "#priceblock_ourprice",  # Most common location
            "#priceblock_saleprice",  # Sale price
            "#priceblock_dealprice",  # Deal price
            ".a-price .a-offscreen",  # New price format
            ".a-price span.a-offscreen",  # Another common format
            "#price_inside_buybox",  # Price in buy box
            ".a-color-price",  # Generic price class
            ".a-section .a-price",  # Another price container
            "#usedBuySection .a-color-price",  # Used price
            "#tmmSwatches .a-color-price"  # Format price
        ]
        
        for selector in price_selectors:
            try:
                price_element = soup.select_one(selector)
                if price_element:
                    price_text = price_element.get_text(strip=True)
                    if price_text:
                        self.logger.info(f"Found product price using selector: {selector}")
                        return price_text
            except Exception as e:
                self.logger.warning(f"Error extracting price with selector {selector}: {str(e)}")
                continue
                
        # Try to find price within product details if not found elsewhere
        try:
            # Look for any element that might contain price information
            price_keywords = ["Price:", "Price", "$", "USD", "Cost:", "Current Price:"]
            for keyword in price_keywords:
                elements = soup.find_all(text=lambda text: text and keyword in text)
                for element in elements:
                    # Extract price pattern
                    price_match = re.search(r'(\$\d+(?:\.\d{2})?)', element.strip())
                    if price_match:
                        self.logger.info(f"Found product price using keyword search: {keyword}")
                        return price_match.group(1)
        except Exception as e:
            self.logger.warning(f"Error extracting price with keyword search: {str(e)}")
                
        return None
    
    def scrape_product(self, url: str) -> Tuple[Optional[str], Dict[str, Any], Optional[str], Optional[str]]:
        """
        Scrape product description, specifications, image, and price from an Amazon product page.
        
        Args:
            url (str): URL of the Amazon product page.
            
        Returns:
            Tuple[Optional[str], Dict[str, Any], Optional[str], Optional[str]]: 
                description, specifications, image URL, and price
        """
        html_content = self.fetch_page(url)
        
        if not html_content:
            self.logger.error("Failed to fetch product page")
            return None, {}, None, None
            
        # Extract the product description
        description = self.extract_product_description(html_content)
        if description:
            self.logger.info("Successfully extracted product description")
            
        # Extract the product technical specifications
        specs = self.extract_tech_specs(html_content)
        if specs:
            self.logger.info(f"Successfully extracted {len(specs)} technical specifications")
            
        # Extract the product image URL
        image_url = self.extract_product_image(html_content)
        if image_url:
            self.logger.info(f"Successfully extracted product image URL: {image_url}")
        
        # Extract the product price
        price = self.extract_product_price(html_content)
        if price:
            self.logger.info(f"Successfully extracted product price: {price}")
        
        return description, specs, image_url, price

def scrape_amazon_product(url: str) -> Tuple[Optional[str], Dict[str, Any], Optional[str], Optional[str]]:
    """
    Utility function to scrape product details from an Amazon product page.
    
    Args:
        url (str): URL of the Amazon product page.
        
    Returns:
        Tuple[Optional[str], Dict[str, Any], Optional[str], Optional[str]]: 
            description, specifications, image URL, and price
    """
    scraper = AmazonScraper()
    return scraper.scrape_product(url)

# Example usage
if __name__ == "__main__":
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Example URL
    url = "https://www.amazon.com/dp/B09X7MPX8L"
    
    # Option 1: Use the utility function
    description, specs, image_url, price = scrape_amazon_product(url)
    
    # Option 2: Create and use a scraper instance directly
    # scraper = AmazonScraper()
    # description, specs, image_url, price = scraper.scrape_product(url)
    
    print("Product Description:")
    print(description)
    print("\nTechnical Specifications:")
    for key, value in specs.items():
        print(f"{key}: {value}")
    print("\nProduct Image URL:")
    print(image_url)
    print("\nProduct Price:")
    print(price)
