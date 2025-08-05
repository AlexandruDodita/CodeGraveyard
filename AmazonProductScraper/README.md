# 🛒 Amazon Product Review Aggregator & Comparator

> This micro SaaS tool aggregates Amazon product reviews, providing AI-generated summaries to help users make informed purchasing decisions. It also offers similar product comparisons to show alternatives. The platform monetizes through affiliate links and targeted advertisements.

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.8+-blue.svg" alt="Python 3.8+"/>
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License: MIT"/>
  <img src="https://img.shields.io/badge/Status-Active-success.svg" alt="Status: Active"/>
</p>

![Demo Screenshot](https://via.placeholder.com/800x400?text=Amazon+Product+Analyzer+Demo)

## 📋 Table of Contents
- [Features](#-features)
- [Installation](#-installation)
- [Usage](#-usage)
- [System Architecture](#-system-architecture)
- [Project Structure](#-project-file-structure)
- [Contributing](#-contributing)
- [License](#-license)

## ✨ Features

- **🔍 Product Information**: Extract accurate details about any Amazon product
- **📊 Review Analysis**: Analyze review sentiment and rating distributions
- **🤖 AI-Powered Summaries**: Generate concise summaries of customer feedback
- **👍 Pros & Cons**: Automatic extraction of product strengths and weaknesses
- **🔄 Similar Products**: Find alternatives to the selected product

## 📥 Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/amazon-product-analyzer.git
cd amazon-product-analyzer

# Install dependencies
pip install -r requirements.txt
```

### Prerequisites
- Python 3.8+
- BeautifulSoup4
- Requests
- Other packages listed in requirements.txt

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
              │  JSON Data  │ │Command Line UI│
              └─────────────┘ └──────────────┘
```

### Data Flow
1. **Input**: Amazon product URL (either direct link or ASIN)
2. **Web Scraping**: Extract product details, reviews, and similar products
3. **Analysis**: Calculate statistics and metrics from review data
4. **AI Processing**: Generate summaries, extract key points, pros and cons
5. **Output**: JSON formatted data and terminal readable summary

## 📁 Project File Structure

See [documentation_guide.md](documentation_guide.md) for detailed project structure.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details. 