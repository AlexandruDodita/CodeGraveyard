/**
 * Amazon Product Analyzer - Frontend JavaScript
 * Handles UI interactions, API calls, and rendering product data
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const analyzeForm = document.getElementById('analyze-form');
    const resultsContainer = document.getElementById('results-container');
    const loadingSpinner = document.getElementById('loading-spinner');
    const urlInput = document.getElementById('product-url');
    const compareButton = document.getElementById('compare-another');
    const errorMessage = document.getElementById('error-message');
    const fallbackContainer = document.getElementById('fallback-container');
    const mainProductImageLink = document.getElementById('main-product-image-link');
    const mainProductTitleLink = document.getElementById('main-product-title-link');
    const seeMoreReviewsButton = document.getElementById('see-more-reviews-button');
    const deepseekContainer = document.getElementById('deepseek-analysis-container');
    const deepseekLoading = document.getElementById('deepseek-loading');
    const deepseekContent = document.getElementById('deepseek-content');
    const themeToggle = document.getElementById('theme-toggle');

    let currentAllReviews = [];
    let numReviewsShown = 0;
    const reviewsPerLoad = 5;
    let isProductLoaded = false; // Track if product data is currently loaded

    // Theme handling
    const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");
    
    if (prefersDarkScheme.matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggle.checked = true;
    }
    
    themeToggle.addEventListener('change', function() {
        if (this.checked) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
        }
    });

    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
        themeToggle.checked = savedTheme === 'dark';
    }

    // Fallback data (sample data for when fetch fails)
    const fallbackData = {
        "url": "https://www.amazon.com/sample-product",
        "product_details": {
            "description": "Sample Product - This is fallback data shown when the actual data cannot be loaded. This could be due to CORS restrictions when running locally.",
            "specifications": {
                "Brand": "Sample Brand",
                "Model": "Fallback Model",
                "Color": "Blue",
                "Dimensions": "10 x 5 x 2 inches",
                "Weight": "1.5 pounds"
            },
            "image_url": "https://via.placeholder.com/300x300?text=Sample+Product",
            "price": "$99.99"
        },
        "review_data": {
            "reviews": [
                {
                    "reviewer_name": "Sample Reviewer",
                    "title": "5.0 out of 5 stars Great Product!",
                    "rating": 5.0,
                    "date": "Reviewed on January 1, 2025",
                    "text": "This is a sample review shown when the actual reviews cannot be loaded. The product works great!",
                    "verified_purchase": true,
                    "helpful_votes": 10
                },
                {
                    "reviewer_name": "Another Reviewer",
                    "title": "4.0 out of 5 stars Good but could be better",
                    "rating": 4.0,
                    "date": "Reviewed on February 15, 2025",
                    "text": "Another sample review. Product is good but has a few minor issues that could be improved.",
                    "verified_purchase": true,
                    "helpful_votes": 5
                },
                {
                    "reviewer_name": "Third Reviewer",
                    "title": "3.0 out of 5 stars Mixed feelings",
                    "rating": 3.0,
                    "date": "Reviewed on March 20, 2025",
                    "text": "A third sample review. I have mixed feelings about this product. Some features are nice but others need improvement.",
                    "verified_purchase": false,
                    "helpful_votes": 2
                }
            ],
            "analysis": {
                "average_rating": 4.0,
                "total_reviews": 3,
                "rating_counts": {
                    "1_star": 0,
                    "2_star": 0,
                    "3_star": 1,
                    "4_star": 1,
                    "5_star": 1
                }
            }
        }
    };

    // Event Listeners
    analyzeForm.addEventListener('submit', handleAnalyzeSubmit);
    const analyzeAnotherButton = document.getElementById('analyze-another');
    if (analyzeAnotherButton) {
        analyzeAnotherButton.addEventListener('click', resetUI);
    }
    document.getElementById('try-fallback').addEventListener('click', useFallbackData);
    if (seeMoreReviewsButton) {
        seeMoreReviewsButton.addEventListener('click', handleSeeMoreReviews);
    }

    /**
     * Handles the analyze form submission
     * @param {Event} e - The form submit event
     */
    async function handleAnalyzeSubmit(e) {
        e.preventDefault();
        
        const url = urlInput.value.trim();
        if (!url) {
            showError('Please enter an Amazon product URL');
            return;
        }
        
        if (!isValidAmazonUrl(url)) {
            showError('Please enter a valid Amazon product URL');
            return;
        }
        
        showLoading();
        
        try {
            let data;
            
            try {
                // Run the Python backend script to analyze the URL and update review.json
                const pythonResponse = await runPythonBackend(url);
                
                if (pythonResponse.success) {
                    // If Python script succeeds, fetch the updated review.json
                    const response = await fetch('../review.json?' + new Date().getTime()); // Add timestamp to prevent caching
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    
                    data = await response.json();
                } else {
                    throw new Error(pythonResponse.error || 'Failed to analyze URL with backend');
                }
            } catch (fetchError) {
                console.error('Error fetching product data:', fetchError);
                // Show fallback error UI instead of just an error message
                showFallbackError(fetchError);
                return;
            }
            
            renderProductData(data);
            showResults();
            
            // Automatically run DeepSeek analysis
            runDeepSeekAnalysis();
            
        } catch (error) {
            console.error('Error processing product data:', error);
            showError('Failed to process product data. Please try again later.');
        } finally {
            hideLoading();
        }
    }

    /**
     * Runs the Python backend script to analyze the URL
     * @param {string} url - The Amazon product URL to analyze
     * @returns {Promise<Object>} - Object with success status and any error messages
     */
    async function runPythonBackend(url) {
        // For security, we'll use a simple endpoint that runs the Python script
        try {
            const response = await fetch('/run-analysis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: url })
            });
            
            if (!response.ok) {
                return { 
                    success: false, 
                    error: `Server error: ${response.status} ${response.statusText}` 
                };
            }
            
            return await response.json();
        } catch (error) {
            // If the server request fails completely
            return { 
                success: false, 
                error: `Connection error: ${error.message}. Please ensure the server is running.` 
            };
        }
    }

    /**
     * Runs the DeepSeek analysis
     */
    async function runDeepSeekAnalysis() {
        if (!isProductLoaded) {
            showError('Please analyze a product first before generating DeepSeek analysis');
            return;
        }

        // Show loading state
        deepseekLoading.classList.remove('hidden');
        deepseekContent.classList.add('hidden');
        
        try {
            // Call the DeepSeek API endpoint
            const response = await fetch('/run-deepseek-analysis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }
            
            const result = await response.json();
            
            // Display the DeepSeek analysis
            renderDeepseekAnalysis(result);
            
        } catch (error) {
            console.error('Error generating DeepSeek analysis:', error);
            document.getElementById('deepseek-summary').textContent = `Failed to generate DeepSeek analysis: ${error.message}. Check the API key in scripts/python/deepseek_api.py.`;
            document.getElementById('deepseek-strengths-list').innerHTML = '<li>API error occurred</li>';
            document.getElementById('deepseek-issues-list').innerHTML = '<li>Could not process review data</li>';
            document.getElementById('deepseek-buyer-personas').textContent = 'Buyer personas not available due to API error';
        } finally {
            // Hide loading spinner
            deepseekLoading.classList.add('hidden');
            deepseekContent.classList.remove('hidden');
        }
    }

    /**
     * Shows the fallback error screen with options
     * @param {Error} error - The error that occurred
     */
    function showFallbackError(error) {
        hideLoading();
        fallbackContainer.classList.remove('hidden');
        analyzeForm.classList.add('hidden');
        
        // Update error details
        document.getElementById('error-details').textContent = error.toString();
        
        // Check for specific error types
        if (error.toString().includes('CORS') || error.toString().includes('NetworkError')) {
            document.getElementById('cors-message').classList.remove('hidden');
            document.getElementById('amazon-error-message').classList.add('hidden');
            document.getElementById('server-error-message').classList.add('hidden');
        } else if (error.toString().includes('500') || error.toString().includes('Server error: 500')) {
            document.getElementById('cors-message').classList.add('hidden');
            document.getElementById('amazon-error-message').classList.add('hidden');
            document.getElementById('server-error-message').classList.remove('hidden');
        } else if (error.toString().includes('No data scraped') || error.toString().includes('Amazon blocked')) {
            document.getElementById('cors-message').classList.add('hidden');
            document.getElementById('amazon-error-message').classList.remove('hidden');
            document.getElementById('server-error-message').classList.add('hidden');
        } else {
            document.getElementById('cors-message').classList.add('hidden');
            document.getElementById('amazon-error-message').classList.add('hidden');
            document.getElementById('server-error-message').classList.add('hidden');
        }
    }

    /**
     * Uses the fallback data when the fetch fails
     */
    function useFallbackData() {
        fallbackContainer.classList.add('hidden');
        renderProductData(fallbackData);
        showResults();
        
        // Use sample DeepSeek analysis for fallback data
        const sampleDeepseekAnalysis = {
            "top_strengths": [
                {
                    "feature": "Product quality",
                    "listing_advice": "Highlight 'Premium construction with durable materials' in your first bullet point",
                    "example_quote": "Good quality for the price"
                },
                {
                    "feature": "Ease of use",
                    "listing_advice": "Add 'User-friendly interface with intuitive controls' to product description",
                    "example_quote": "Easy setup process noted by users"
                }
            ],
            "buyer_personas": [
                {
                    "persona": "Budget-conscious shopper",
                    "description": "Looking for good value while still getting acceptable quality and features"
                },
                {
                    "persona": "Convenience seeker",
                    "description": "Values easy setup and straightforward operation without technical complications"
                }
            ],
            "negative_trends": [
                {
                    "issue": "Design limitations",
                    "seller_fix": "Consider mentioning design tradeoffs in the description to set proper expectations",
                    "severity": "low"
                },
                {
                    "issue": "Feature set limitations",
                    "seller_fix": "Clearly list what features are included to avoid disappointment from expecting more",
                    "severity": "medium"
                }
            ],
            "undocumented_features": [
                {
                    "feature": "Helpful customer support",
                    "quote": "Helpful customer service mentioned"
                }
            ],
            "standout_quotes": [
                "Product works as advertised",
                "Good quality for the price",
                "Easy setup process noted by users"
            ]
        };
        
        renderDeepseekAnalysis(sampleDeepseekAnalysis);
        deepseekLoading.classList.add('hidden');
        deepseekContent.classList.remove('hidden');
    }

    /**
     * Validates if the URL is from Amazon
     * @param {string} url - The URL to validate
     * @returns {boolean} True if valid Amazon URL
     */
    function isValidAmazonUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.includes('amazon.com') || 
                   urlObj.hostname.includes('amazon.');
        } catch (e) {
            return false;
        }
    }

    /**
     * Formats the raw price string from similar products.
     * Extracts current price and optionally list/typical price.
     * Example input: "-26%$95.99$95.99List:$129.99$129.99"
     * Output: "$95.99 (was $129.99)" or just "$95.99"
     * @param {string} priceString - The raw price string.
     * @returns {string} - Formatted price string.
     */
    function formatSimilarProductPrice(priceString) {
        if (!priceString || typeof priceString !== 'string') {
            return 'Price not available';
        }

        // Regex to find the primary price (often repeated or after a percentage)
        // It looks for a price pattern like $xx.xx
        const primaryPriceMatch = priceString.match(/\$(\d+\.\d{2})/);
        let currentPrice = primaryPriceMatch ? `$${primaryPriceMatch[1]}` : null;

        // Try to find a list or typical price
        const listPriceMatch = priceString.match(/(?:List|Typical):\s*\$(\d+\.\d{2})/i);
        let originalPrice = listPriceMatch ? `$${listPriceMatch[1]}` : null;

        // If current price wasn't found with the first regex, try another common pattern
        // (e.g., if it's just $xx.xx without discount percentage)
        if (!currentPrice) {
            const simplerPriceMatch = priceString.match(/^\$(\d+\.\d{2})/);
            if (simplerPriceMatch) {
                currentPrice = `$${simplerPriceMatch[1]}`;
            }
        }
        
        // Fallback if parsing fails significantly
        if (!currentPrice && priceString.includes('$')) {
            // Grab the first price-like pattern if nothing else worked
            const genericPriceMatch = priceString.match(/\$(\d+\.\d{2})/);
            if (genericPriceMatch) currentPrice = `$${genericPriceMatch[1]}`;
        }

        if (currentPrice && originalPrice && currentPrice !== originalPrice) {
            return `${currentPrice} (was ${originalPrice})`;
        }
        return currentPrice || priceString; // Return original if parsing fails or only one price
    }

    /**
     * Renders the list of product reviews.
     * @param {Array<Object>} reviewsToDisplay - Array of review objects to render.
     */
    function renderReviewsList(reviewsToDisplay) {
        const reviewsList = document.getElementById('reviews-list');
        if (!reviewsList) return;

        // Clear only the reviews that were added by this function, not the whole container initially
        // If numReviewsShown is 0, it's the first load, so clear everything.
        if (numReviewsShown === 0 || reviewsToDisplay.length === 0) {
             reviewsList.innerHTML = '';
        }

        if (reviewsToDisplay.length === 0 && numReviewsShown === 0) {
            reviewsList.innerHTML = '<p>No reviews available for this product.</p>';
            if (seeMoreReviewsButton) seeMoreReviewsButton.classList.add('hidden');
            return;
        }

        reviewsToDisplay.forEach(review => {
            const reviewEl = document.createElement('article');
            reviewEl.classList.add('review');
            
            const header = document.createElement('header');
            const title = document.createElement('h4');
            const ratingMatch = review.title ? review.title.match(/(\d+\.\d+)\s+out of\s+(\d+)\s+stars(.*)/i) : null;

            if (ratingMatch) {
                const [, rating, maxRating, reviewTitle] = ratingMatch;
                const ratingEl = document.createElement('div');
                ratingEl.classList.add('review-rating');
                ratingEl.innerHTML = `${rating} ⭐ out of ${maxRating} stars`;
                header.appendChild(ratingEl);
                title.textContent = reviewTitle.trim();
            } else {
                title.textContent = review.title || 'Review';
            }
            header.appendChild(title);
            
            const meta = document.createElement('div');
            meta.classList.add('review-meta');
            meta.innerHTML = `<span class="reviewer">${review.reviewer_name || 'Anonymous'}</span> | <span class="date">${review.date || 'N/A'}</span>`;
            header.appendChild(meta);
            reviewEl.appendChild(header);
            
            const excerpt = document.createElement('p');
            excerpt.textContent = review.text && review.text.length > 200 ? review.text.substring(0, 200) + '...' : review.text || '';
            reviewEl.appendChild(excerpt);
            
            reviewsList.appendChild(reviewEl);
        });
    }

    /**
     * Handles the 'See more reviews' button click.
     */
    function handleSeeMoreReviews() {
        if (!currentAllReviews || currentAllReviews.length === 0) return;

        const newNumReviewsToShow = numReviewsShown + reviewsPerLoad;
        const reviewsToLoad = currentAllReviews.slice(numReviewsShown, newNumReviewsToShow);
        
        if (reviewsToLoad.length > 0) {
            renderReviewsList(reviewsToLoad); // Append new reviews
            numReviewsShown = newNumReviewsToShow;
        }

        if (numReviewsShown >= currentAllReviews.length) {
            if (seeMoreReviewsButton) seeMoreReviewsButton.classList.add('hidden');
        } else {
            if (seeMoreReviewsButton) seeMoreReviewsButton.classList.remove('hidden');
        }
    }

    /**
     * Renders the DeepSeek analysis in the UI
     * @param {Object} data - The analysis data from DeepSeek
     */
    function renderDeepseekAnalysis(data) {
        // Check if we have valid data
        if (!data || (data.error && !data.raw_response)) {
            document.getElementById('deepseek-summary').textContent = 'Error generating analysis. Please try again later.';
            return;
        }
        
        // If we have raw response that's not JSON, display it directly
        if (data.raw_response && data.error) {
            document.getElementById('deepseek-summary').textContent = data.raw_response;
            document.getElementById('deepseek-strengths-list').innerHTML = '<li>Not available due to formatting error</li>';
            document.getElementById('deepseek-issues-list').innerHTML = '<li>Not available due to formatting error</li>';
            document.getElementById('deepseek-buyer-personas').textContent = 'Buyer personas not available';
            return;
        }
        
        // Handle top strengths (replaces pros)
        const strengthsList = document.getElementById('deepseek-strengths-list');
        strengthsList.innerHTML = '';
        if (data.top_strengths && Array.isArray(data.top_strengths)) {
            data.top_strengths.forEach(strength => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <strong>${strength.feature}</strong>
                    <p class="listing-advice">${strength.listing_advice}</p>
                    ${strength.example_quote ? `<p class="example-quote">"${strength.example_quote}"</p>` : ''}
                `;
                strengthsList.appendChild(li);
            });
        } else {
            strengthsList.innerHTML = '<li>No product strengths available</li>';
        }
        
        // Handle negative trends (replaces cons)
        const issuesList = document.getElementById('deepseek-issues-list');
        issuesList.innerHTML = '';
        if (data.negative_trends && Array.isArray(data.negative_trends)) {
            data.negative_trends.forEach(trend => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <strong>${trend.issue}</strong> 
                    <span class="severity severity-${trend.severity || 'medium'}">${trend.severity || 'medium'}</span>
                    <p class="seller-fix">Fix: ${trend.seller_fix}</p>
                `;
                issuesList.appendChild(li);
            });
        } else {
            issuesList.innerHTML = '<li>No negative trends identified</li>';
        }
        
        // Handle buyer personas (new section)
        const personasEl = document.getElementById('deepseek-buyer-personas');
        personasEl.innerHTML = '';
        if (data.buyer_personas && Array.isArray(data.buyer_personas)) {
            const personasList = document.createElement('ul');
            personasList.className = 'personas-list';
            
            data.buyer_personas.forEach(persona => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <strong>${persona.persona}</strong>
                    <p>${persona.description}</p>
                `;
                personasList.appendChild(li);
            });
            
            personasEl.appendChild(personasList);
        } else {
            personasEl.textContent = 'No buyer personas identified';
        }
        
        // Handle undocumented features (new section)
        const featuresEl = document.getElementById('deepseek-undocumented-features');
        featuresEl.innerHTML = '';
        if (data.undocumented_features && Array.isArray(data.undocumented_features)) {
            const featuresList = document.createElement('ul');
            featuresList.className = 'features-list';
            
            data.undocumented_features.forEach(feature => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <strong>${feature.feature}</strong>
                    ${feature.quote ? `<p class="feature-quote">"${feature.quote}"</p>` : ''}
                `;
                featuresList.appendChild(li);
            });
            
            featuresEl.appendChild(featuresList);
        } else {
            featuresEl.textContent = 'No undocumented features identified';
        }
        
        // Handle standout quotes (new section)
        const quotesEl = document.getElementById('deepseek-standout-quotes');
        quotesEl.innerHTML = '';
        if (data.standout_quotes && Array.isArray(data.standout_quotes)) {
            const quotesList = document.createElement('ul');
            quotesList.className = 'quotes-list';
            
            data.standout_quotes.forEach(quote => {
                const li = document.createElement('li');
                li.innerHTML = `"${quote}"`;
                quotesList.appendChild(li);
            });
            
            quotesEl.appendChild(quotesList);
        } else {
            quotesEl.textContent = 'No standout quotes identified';
        }
    }

    /**
     * Renders the product data in the UI
     * @param {Object} data - The product data JSON
     */
    function renderProductData(data) {
        // Set flag that product is loaded
        isProductLoaded = true;
        
        // Product Card
        if (mainProductImageLink) {
            mainProductImageLink.href = data.url;
        }
        document.getElementById('product-image').src = data.product_details.image_url;
        document.getElementById('product-image').alt = data.product_details.description ? data.product_details.description.substring(0, 50) + '...' : 'Product Image';
        
        if (mainProductTitleLink) {
            mainProductTitleLink.href = data.url;
        }

        // Extract product title more intelligently
        let title = data.product_details.description || "Product Title Not Available";
        
        // Handle case when title contains "About this item"
        if (title.includes('About this item')) {
            // Find the first sentence after "About this item"
            const match = title.match(/About this item(.*?)(?=\.|BLAZING|ROG|SWIFT|XBOX|$)/i);
            if (match && match[1]) {
                title = match[1].trim();
            } else {
                // Fallback: just remove "About this item" prefix
                title = title.replace('About this item', '').trim();
            }
        }
        
        // If title contains a dash, use content before the dash
        if (title.includes('-')) {
            title = title.split('-')[0].trim();
        }
        
        document.getElementById('product-title').textContent = title;
        document.getElementById('product-price').textContent = data.product_details.price || "Price Not Available";
        
        // Clean up description
        let description = data.product_details.description || "Description not available.";
        
        // Remove "About this item" from the beginning
        if (description.startsWith('About this item')) {
            description = description.replace('About this item', '').trim();
        }
        
        // Remove "See more product details" suffix
        if (description.includes('›See more product details')) {
            description = description.replace('›See more product details', '').trim();
        }
        
        document.getElementById('product-description').textContent = description;
        
        // Specifications Table
        const specsTable = document.getElementById('specs-table');
        specsTable.innerHTML = '';
        
        Object.entries(data.product_details.specifications || {}).forEach(([key, value]) => {
            const row = document.createElement('tr');
            
            const keyCell = document.createElement('th');
            keyCell.textContent = key;
            row.appendChild(keyCell);
            
            const valueCell = document.createElement('td');
            valueCell.textContent = value;
            row.appendChild(valueCell);
            
            specsTable.appendChild(row);
        });
        
        // Reviews - Initial Load
        currentAllReviews = (data.review_data && data.review_data.reviews) ? data.review_data.reviews : [];
        numReviewsShown = 0; // Reset for new product
        const initialReviewsToDisplay = currentAllReviews.slice(0, 3);
        renderReviewsList(initialReviewsToDisplay); // Use the new function
        numReviewsShown = initialReviewsToDisplay.length;

        if (currentAllReviews.length > 3) {
            if (seeMoreReviewsButton) seeMoreReviewsButton.classList.remove('hidden');
        } else {
            if (seeMoreReviewsButton) seeMoreReviewsButton.classList.add('hidden');
        }
        
        // Similar Products
        const similarContainer = document.getElementById('similar-products-container');
        const similarList = document.getElementById('similar-products-list');
        similarList.innerHTML = '';
        
        const maxSimilarProducts = 6;
        const productsToDisplay = data.similar_products ? data.similar_products.slice(0, maxSimilarProducts) : [];

        if (productsToDisplay.length > 0) {
            similarContainer.classList.remove('hidden');
            
            productsToDisplay.forEach(product => {
                const productEl = document.createElement('div');
                productEl.classList.add('similar-product');
                
                // Link for image and title to product page
                const productLink = document.createElement('a');
                productLink.href = product.url || '#';
                productLink.target = '_blank'; // Open in new tab

                const img = document.createElement('img');
                img.src = product.image_url || 'https://via.placeholder.com/100';
                img.alt = product.title || 'Similar product';
                productLink.appendChild(img);

                const titleEl = document.createElement('h4');
                titleEl.textContent = product.title || 'Product';
                productLink.appendChild(titleEl);

                productEl.appendChild(productLink);

                // Price - ensure it exists
                if (product.price) {
                    const priceEl = document.createElement('p');
                    priceEl.classList.add('similar-product-price');
                    priceEl.textContent = formatSimilarProductPrice(product.price);
                    productEl.appendChild(priceEl);
                }

                // Button to analyze this similar product
                const analyzeSimilarButton = document.createElement('button');
                analyzeSimilarButton.textContent = 'Analyze this';
                analyzeSimilarButton.classList.add('button', 'button-small'); // Add a new class for smaller button
                analyzeSimilarButton.addEventListener('click', () => {
                    urlInput.value = product.url; // Set the main input field
                    handleAnalyzeSubmit(new Event('submit')); // Trigger analysis
                });
                productEl.appendChild(analyzeSimilarButton);
                
                similarList.appendChild(productEl);
            });
        } else {
            similarContainer.classList.add('hidden');
        }
    }

    /**
     * Shows the loading spinner and hides the form
     */
    function showLoading() {
        loadingSpinner.classList.remove('hidden');
        analyzeForm.classList.add('hidden');
        errorMessage.classList.add('hidden');
        fallbackContainer.classList.add('hidden');
    }

    /**
     * Hides the loading spinner
     */
    function hideLoading() {
        loadingSpinner.classList.add('hidden');
    }

    /**
     * Shows the results container and hides the form
     */
    function showResults() {
        resultsContainer.classList.remove('hidden');
        analyzeForm.classList.add('hidden');
        fallbackContainer.classList.add('hidden');
    }

    /**
     * Resets the UI back to the initial state
     */
    function resetUI() {
        resultsContainer.classList.add('hidden');
        analyzeForm.classList.remove('hidden');
        fallbackContainer.classList.add('hidden');
        urlInput.value = '';
        currentAllReviews = [];
        numReviewsShown = 0;
        isProductLoaded = false; // Reset product loaded flag
        
        const reviewsList = document.getElementById('reviews-list');
        if(reviewsList) reviewsList.innerHTML = '';
        if (seeMoreReviewsButton) seeMoreReviewsButton.classList.add('hidden');
    }

    /**
     * Shows an error message
     * @param {string} message - The error message to display
     */
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    }
}); 