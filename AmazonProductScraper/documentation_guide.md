# 🛒 Amazon Product Review Aggregator & Comparator

> This micro SaaS tool aggregates Amazon product reviews, providing AI-generated summaries to help users make informed purchasing decisions. It also offers similar product comparisons to show alternatives. The platform monetizes through affiliate links and targeted advertisements.

---

## 📋 Table of Contents
- [Installation](#-installation)
- [Usage](#-usage)
- [System Architecture](#-system-architecture)
- [Project Structure](#-project-file-structure)
- [Frontend Interface](#-frontend-interface)
- [Local Development](#-local-development)
- [Future Development](#-future-components)
- [Testing](#-test-components)

---

## 📥 Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/amazon-product-analyzer.git
cd amazon-product-analyzer

# Install dependencies
pip install -r requirements.txt
```

### Dependencies
- Python 3.8+
- BeautifulSoup4
- Requests
- Other packages listed in requirements.txt

---

## 🚀 Usage

### Basic Usage
```bash
python main.py "https://www.amazon.com/dp/B00SX2YSMS" -o results.json
```

### Advanced Options
```bash
# With verbose logging
python main.py "https://www.amazon.com/dp/B00SX2YSMS" -v -o results.json

# Specify max review pages to scrape
python main.py "https://www.amazon.com/dp/B00SX2YSMS" -p 5 -o results.json

# Skip similar products search
python main.py "https://www.amazon.com/dp/B00SX2YSMS" --skip-similar -o results.json

# Provide AI API key for better summaries
python main.py "https://www.amazon.com/dp/B00SX2YSMS" -k "your-api-key" -o results.json
```

### Example Output
```json
{
  "url": "https://www.amazon.com/dp/B00SX2YSMS",
  "product_details": {
    "description": "Product description...",
    "specifications": { ... },
    "image_url": "https://m.media-amazon.com/images/I/71XCVyI4unL._AC_SX522_.jpg",
    "price": "$195.99"
  },
  "review_data": {
    "reviews": [ ... ],
    "analysis": {
      "average_rating": 4.5,
      "total_reviews": 15,
      "rating_counts": { ... },
      "top_positive_reviews": [ ... ],
      "top_negative_reviews": [ ... ]
    }
  },
  "ai_summary": {
    "summary": "Overall positive reviews...",
    "key_points": [ ... ],
    "pros": [ ... ],
    "cons": [ ... ]
  },
  "similar_products": [ ... ]
}
```

---

## 🏗️ System Architecture

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  Amazon.com   │────▶│  Web Scraper  │────▶│ Review Parser │
└───────────────┘     └───────────────┘     └───────────────┘
                                                    │
                                                    ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│ Similar Items │◀────│ AI Summarizer │◀────│Data Aggregator│
└───────────────┘     └───────────────┘     └───────────────┘
        │                     │                     │
        └─────────────┬──────────────┬─────────────┘
                      │              │
                      ▼              ▼
              ┌─────────────┐ ┌──────────────┐
              │  JSON Data  │ │   User UI    │
              └─────────────┘ └──────────────┘
```

### Data Flow
1. **Input**: Amazon product URL (either direct link or ASIN)
2. **Web Scraping**: Extract product details, reviews, and similar products
3. **Analysis**: Calculate statistics and metrics from review data
4. **AI Processing**: Generate summaries, extract key points, pros and cons
5. **Output**: JSON formatted data and user-friendly UI presentation

---

## 📁 Project File Structure

### 🔸 Core Components

#### [`main.py`](main.py) - Command-line interface and main entry point
*Orchestrates the workflow and provides user interface*

| Function | Description |
|----------|-------------|
| **`setup_logging(verbose)`** | Configures logging with appropriate verbosity level |
| **`extract_product_details(url)`** | Extracts product information, specifications, and image URL |
| **`extract_and_analyze_reviews(url, max_pages)`** | Extracts and analyzes product reviews |
| **`generate_ai_summary(reviews, api_key)`** | Generates AI summaries from review data |
| **`process_product(...)`** | Main pipeline function |
| **`main()`** | Entry point that handles CLI arguments |

#### [`scripts/python/scraper.py`](scripts/python/scraper.py) - Core scraping functionality
*Extracts product data from Amazon pages*

**`AmazonScraper`** - OOP implementation with resilient HTML parsing
- **`__init__(user_agent)`** - Initializes scraper with customizable user agent
- **`fetch_page(url)`** - Retrieves HTML content with error handling
- **`extract_product_description(html_content)`** - Parses product descriptions
- **`extract_tech_specs(html_content)`** - Extracts technical specifications
- **`_extract_from_tables(soup)`** - Extracts specifications from tables with validation to prevent duplicate values
- **`_extract_from_bullets(soup)`** - Extracts specifications from bullet lists with validation checks
- **`extract_product_image(html_content)`** - Extracts product display image URL
- **`extract_product_price(html_content)`** - Extracts product price
- **`scrape_product(url)`** - Main orchestration method

**Utility Functions**
- **`scrape_amazon_product(url)`** - Simplified access to scraping functionality

#### [`scripts/python/review_analyzer.py`](scripts/python/review_analyzer.py) - Review processing and analysis
*Extracts and analyzes Amazon product reviews*

**`ReviewAnalyzer`** - Handles review extraction and sentiment analysis
- **`__init__(user_agent)`** - Initializes the analyzer
- **`extract_reviews(product_url, max_pages)`** - Extracts reviews with direct web scraping
- **`_parse_review_page(html_content)`** - Parses HTML for reviews
- **`_extract_review_snippets(soup)`** - Extracts review snippets from product pages
- **`analyze_sentiment(reviews)`** - Analyzes rating distribution, sentiment, and extracts top positive/negative reviews
- **`find_similar_products(product_url)`** - Finds similar products through web scraping
- **`_extract_similar_product_info(element)`** - Extracts product details

**Utility Functions**
- **`analyze_product_reviews(url, max_review_pages)`** - Quick review analysis

#### [`scripts/python/ai_summarizer.py`](scripts/python/ai_summarizer.py) - AI integration
*Generates summaries from review data*

**`ReviewSummarizer`** - Creates concise, AI-generated summaries
- **`__init__(api_key)`** - Initializes with optional API key
- **`generate_summary(reviews)`** - Processes reviews into summaries
- **`highlight_key_points(reviews)`** - Extracts important points

**Utility Functions**
- **`summarize_reviews(reviews, api_key)`** - Quick summary generation

#### [`scripts/python/deepseek_api.py`](scripts/python/deepseek_api.py) - DeepSeek AI integration
*Handles DeepSeek AI API integration for advanced product analysis. Requires a DEEPSEEK_API_KEY to be set in a .env file in the project root.*

**Key Functions**
- **`load_review_data(filepath)`** - Loads review data from a JSON file.
- **`generate_mock_data()`** - Generates mock product data if `review.json` is unavailable.
- **`generate_prompt(data)`** - Creates a structured prompt for the DeepSeek API based on product and review data.
- **`get_deepseek_analysis(prompt)`** - Queries the DeepSeek API with the generated prompt and returns the analysis.
- **`generate_mock_analysis()`** - Generates a mock analysis if the API call fails.
- **`save_response(response, output_path)`** - Saves the API response to a JSON file, cleaning up markdown if necessary.
- **`main()`** - Orchestrates the loading of data, prompt generation, API call, and saving the response.

#### [`scripts/python/comparison_analyzer.py`](scripts/python/comparison_analyzer.py) - Product comparison analysis
*Analyzes and compares two Amazon products using DeepSeek AI. Requires a DEEPSEEK_API_KEY to be set in a .env file in the project root.*

**Key Functions**
- **`read_comparison_data()`** - Reads `comparison_data.json`.
- **`read_comparison_prompt()`** - Reads `comparison_prompt.txt`.
- **`generate_comparison_prompt(product_a, product_b)`** - Creates a structured comparison prompt for DeepSeek.
- **`format_reviews(reviews)`** - Helper to format reviews for the prompt.
- **`call_deepseek_api(prompt)`** - Calls the DeepSeek API with the prompt.
- **`extract_json_from_response(response)`** - Extracts and parses JSON from the API response.
- **`main()`** - Main function to orchestrate the comparison analysis.

### 🔸 Frontend Components

#### [`pages/index.html`](pages/index.html) - Main landing page
*Provides navigation to the analyzer and comparison features*

**Key Sections**
- **Header** - App name and description
- **Navigation Cards** - Cards to navigate to Product Analyzer and Product Comparison
- **Theme Toggle** - Button to switch between light and dark themes
- **Footer** - Copyright and attribution

#### [`pages/analyzer.html`](pages/analyzer.html) - Single product analysis page
*Provides user interface for analyzing a single Amazon product*

**Semantic Structure**
- **`<header>`** - App name and description
- **`<section class="form-container">`** - URL input form
- **`<section id="results-container">`** - Product analysis results
- **`<section id="fallback-container">`** - Error handling interface
- **`<footer>`** - Copyright and attribution

**Key Sections**
- **Product Card** - Displays product image, title, price, and description
- **Specifications Table** - Shows product specifications in a two-column layout
- **Review Highlights** - Displays AI-generated summary with pros and cons
- **Top Reviews** - Shows the top 3 user reviews with metadata
- **Similar Products** - Displays alternative product options if available
- **DeepSeek Analysis** - Shows AI-generated insights directly after the product card
- **Ad Containers** - Responsive ad sections (left, right, bottom)
- **Theme Toggle** - Button to switch between light and dark themes

#### [`pages/comparison.html`](pages/comparison.html) - Product comparison page
*Provides interface for comparing two Amazon products side-by-side*

**Semantic Structure**
- **`<header>`** - App name with navigation to home
- **`<section class="form-container">`** - Form with inputs for two product URLs
- **`<section id="comparison-results-container">`** - Comparison results with structured layout
- **`<footer>`** - Copyright and attribution

**Key Sections**
- **Product Cards** - Two product cards (dark red borders) showing basic product information
- **Main Content Area** - Comparison analysis (blue border) containing:
  - **Specification Comparison** (grey background) - Direct comparison of product specs with highlighting for better values
  - **Product Advantages** (green background) - Features where one product outperforms the other
  - **Critical Weaknesses** (purple background) - Significant issues in either product
  - **Shared Strengths** (yellow background) - Common positive aspects between products
  - **Unique Selling Points** (brown background) - Distinct advantages for each product
  - **Buyer Recommendation** (pink background) - Guidance on which buyers would prefer each product
- **Ad Sections** - Google Ads containers (orange borders) placed on left, right, and bottom of page
- **Theme Toggle** - Button to switch between light and dark themes

#### [`styles/main.css`](styles/main.css) - Styling for the application
*Mobile-first responsive design with clean visual components*

**Key Features**
- **Responsive Layout** - Adapts to different screen sizes
- **Card-based Design** - Clear visual separation of content sections
- **Modern Typography** - Clean and readable text hierarchy
- **Loading Indicators** - Visual feedback during data processing
- **Error Displays** - Informative error messages with troubleshooting help
- **Dark/Light Theme** - Toggleable theme with preference stored in local storage
- **Grid Layout** - Modern grid-based layout with improved spacing
- **Smooth Transitions** - Visual transitions for theme changes and content loading
- **Ad Container Styling** - Responsive ad placement areas
- **Color-coded Comparison Sections** - Distinct visual styling for different comparison aspects

#### [`scripts/js/app.js`](scripts/js/app.js) - Client-side functionality for analyzer page
*Handles user interactions and data rendering for the product analyzer*

**`DOMContentLoaded` Event Handler** - Sets up the application when page loads

**Key Functions**
- **`handleAnalyzeSubmit(e)`** - Processes form submission and fetches product data
- **`renderProductData(data)`** - Populates the UI with product information
- **`showFallbackError(error)`** - Displays user-friendly error messages for different error types
- **`useFallbackData()`** - Provides mock data when real data can't be fetched
- **`showLoading()`/`hideLoading()`** - Manages loading state visibility
- **`resetUI()`** - Returns to initial state for analyzing another product
- **`toggleTheme()`** - Switches between light and dark themes
- **`saveThemePreference(theme)`** - Saves theme preference to local storage
- **`loadThemePreference()`** - Loads and applies saved theme preferences
- **`runDeepSeekAnalysis()`** - Automatically triggers DeepSeek analysis after product data loads

#### [`scripts/js/comparison.js`](scripts/js/comparison.js) - Client-side functionality for comparison page
*Handles user interactions and data rendering for the product comparison*

**`DOMContentLoaded` Event Handler** - Sets up the comparison application

**Key Functions**
- **`handleComparisonSubmit(e)`** - Processes form submission and fetches data for two products
- **`fetchProductData(url, productIndex)`** - Fetches product data for a specific product URL
- **`renderProductDetails(container, productData, index)`** - Renders basic product information
- **`generateComparisonAnalysis()`** - Calls the DeepSeek API to compare products
- **`renderSpecificationComparison()`** - Creates a spec comparison table with highlighting for better values
- **`renderComparisonResults(comparisonData)`** - Populates all comparison sections with data
- **`isBetterValue(valueA, valueB, specKey)`** - Determines which spec value is better for comparison
- **`renderProductAdvantages(advantages)`** - Renders the product advantages section
- **`renderCriticalWeaknesses(weaknesses)`** - Renders the critical weaknesses section
- **`renderSharedStrengths(strengths)`** - Renders the shared strengths section
- **`renderUniqueSellingPoints(sellingPoints)`** - Renders the unique selling points section
- **`renderBuyerRecommendation(recommendation)`** - Renders the buyer recommendation section
- **`handleCompareDifferent()`** - Resets the UI to compare different products
- **`toggleTheme()`** - Switches between light and dark themes

#### [`scripts/server.js`](scripts/server.js) - Server with Python integration
*Provides backend API and handles Python script execution*

**Key Features**
- **Static File Serving** - Serves HTML, CSS, JS, and other static assets
- **API Endpoint** - Provides `/run-analysis` endpoint for running Python scripts
- **Comparison Endpoint** - Provides `/run-comparison-analysis` endpoint for comparing products
- **Error Handling** - Detects and reports various error conditions:
  - **Amazon Blocking** - Identifies when Amazon is blocking scraping requests
  - **Invalid JSON** - Detects when invalid or empty data is returned
  - **Script Errors** - Properly captures and reports Python execution errors
- **CORS Support** - Handles cross-origin resource sharing for client-side requests
- **DeepSeek API Integration** - Provides endpoints for DeepSeek analysis and comparison

## 🌐 Local Development

To run the application locally and avoid CORS issues, use one of these approaches:

### Using the Enhanced Server (Recommended)

The simplest way to run the application is with the included Node.js server:

#### Windows
```bash
# Double-click start-server.bat
# Or run from command line:
.\start-server.bat
```

#### Mac/Linux
```bash
# Make the script executable first
chmod +x start-server.sh

# Then run it
./start-server.sh
```

Then open http://localhost:8000/pages/index.html in your browser.

### Handling Amazon Scraping Errors

If you encounter error messages about Amazon blocking your requests:

1. **Rate Limiting**:
   - Amazon may block requests if they suspect scraping activity
   - The application will display an appropriate error message
   - Try again after some time has passed

2. **Sample Data**:
   - When real data can't be fetched, use the "Use Sample Data" button
   - This will display mock data to demonstrate the UI functionality

3. **Infrastructure Options**:
   - For production use, consider using proxies or rotating IP addresses
   - Implement request delays to avoid triggering Amazon's anti-scraping measures
   - Use a headless browser approach for more reliable extraction

---

### 🔹 Future Components

#### `scripts/python/product_comparator.py` - Product comparison
*Will compare similar products based on reviews and specifications*

**`ProductComparator`** - Will find and compare similar products
- **`find_similar_products(product_id)`** - Will locate similar products
- **`generate_comparison_table(products)`** - Will create comparison data

#### `scripts/python/api_service.py` - API endpoints
*Will provide RESTful endpoints for frontend integration*

**`APIService`** - Will expose data through a REST API
- **`get_product_summary(product_id)`** - Will return product data and summaries
- **`get_comparison_data(product_ids)`** - Will return comparison data

---

### 🧪 Test Components

#### [`testers/test_scraper.py`](testers/test_scraper.py)
- **`test_amazon_scraper(url)`** - Tests product extraction

#### [`testers/test_review_analyzer.py`](testers/test_review_analyzer.py)
- **`test_review_analyzer(url)`** - Tests review extraction and analysis

#### [`testers/test_ai_summarizer.py`](testers/test_ai_summarizer.py)
- **`test_ai_summarizer()`** - Tests AI summary generation
- **`test_full_pipeline(product_url)`** - Tests the complete workflow

## Amazon Product Analyzer Documentation

Amazon Product Analyzer is a web application that helps Amazon sellers analyze product listings and reviews. The application provides detailed insights into product performance, customer sentiment, and competitive positioning to optimize product listings.

## Project File Structure

### pages/
**index.html** - Landing page with feature cards to navigate to Product Analyzer and Product Comparison features
**analyzer.html** - Single product analysis page that extracts product details, reviews, and generates AI insights
**comparison.html** - Competitive analysis page that compares two products side-by-side

### scripts/
**scripts/js/app.js** - Core JavaScript for the Product Analyzer page, handles UI interactions and API calls
**scripts/js/comparison.js** - JavaScript for the Product Comparison page, handles comparison UI and API calls
**scripts/server.js** - Node.js server that handles API requests and runs the Python scripts
**scripts/python/deepseek_api.py** - Python script that interacts with the DeepSeek API for review analysis
**scripts/python/comparison_analyzer.py** - Python script for comparing two products using DeepSeek API

### styles/
**styles/main.css** - Stylesheet containing all the CSS for the application

## Key Features

### Product Analyzer
- Extract and display Amazon product details from URL
- Analyze customer reviews using DeepSeek language model
- Generate AI-powered insights with structured JSON schema
- Display strengths, weaknesses, buyer personas, and notable quotes

### Product Comparison
- Compare two Amazon products side-by-side
- Generate a detailed comparison using DeepSeek language model
- Color-coded sections for different comparison aspects:
  - Product cards (dark red) display basic product information
  - Product advantages (green) highlight where one product outperforms the other
  - Critical weaknesses (purple) identify significant issues in either product
  - Shared strengths (yellow) show common positive aspects
  - Unique selling points (brown) display distinct advantages for each product
  - Buyer recommendation (pink) provides guidance on which buyers would prefer each product
  - Specification comparison (grey) presents a head-to-head comparison of specs
- Google Ads integration (orange sections) for monetization

## Feature Details

### DeepSeek API Integration

The product analyzer uses DeepSeek's API to provide AI-powered analysis with the following structure:
```json
{
  "top_strengths": [
    { "feature": "string", "description": "string" }
  ],
  "buyer_personas": [
    { "persona": "string", "description": "string" }
  ],
  "negative_trends": [
    { "issue": "string", "frequency": "string" }
  ],
  "undocumented_features": [
    { "feature": "string", "description": "string" }
  ],
  "standout_quotes": [
    "string", "string", "string"
  ]
}
```

### Comparison Analysis

The product comparison feature uses a specialized DeepSeek prompt to compare two products with the following schema:
```json
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
```

## UI Features

### Theme Support
- Light and dark theme support
- Theme preference saved in localStorage

### Responsive Design
- Works on mobile and desktop devices
- Adjusts layout based on screen size

[File: styles/main.css] - [Manages all global styles, theme configurations, and specific component styles for the application.]
    [Class: .product-card] - [General styling for product display cards, primarily used on the comparison page. Handles flexbox layout for image and details.]
    [Class: .analyzer-product-card] - [Specific styling for the product display card on the analyzer page. Features a simpler, centered layout with a prominent red border for distinction. Contains nested styles for its image, details, title, price, and description areas.]
    [Class: .comparison-product-card] - [Styling for product cards within the comparison page sections, typically smaller and more compact.]