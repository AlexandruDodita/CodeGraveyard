/**
 * Amazon Product Analyzer - Comparison Page JavaScript
 * Handles the comparison of two Amazon products
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const comparisonForm = document.getElementById('comparison-form');
    const comparisonResultsContainer = document.getElementById('comparison-results-container');
    const loadingSpinner = document.getElementById('comparison-loading-spinner');
    const urlInput1 = document.getElementById('product-url-1');
    const urlInput2 = document.getElementById('product-url-2');
    const compareDifferentButton = document.getElementById('compare-different');
    const errorMessage = document.getElementById('comparison-error-message');
    const themeToggle = document.getElementById('theme-toggle');
    
    // New layout elements
    const product1Container = document.getElementById('product1-container');
    const product2Container = document.getElementById('product2-container');
    const product1Content = document.getElementById('product1-content');
    const product2Content = document.getElementById('product2-content');
    const specsComparisonTable = document.getElementById('specs-comparison-table');
    const productAdvantagesEl = document.getElementById('product-advantages');
    const criticalWeaknessesEl = document.getElementById('critical-weaknesses');
    const sharedStrengthsEl = document.getElementById('shared-strengths');
    const uniqueSellingPointsEl = document.getElementById('unique-selling-points');
    const buyerRecommendationEl = document.getElementById('buyer-recommendation');
    
    const resultsSection = comparisonResultsContainer;
    
    // Global variables to store product data
    let product1Data = null;
    let product2Data = null;
    let comparisonData = null;
    
    // Set up event listeners
    comparisonForm.addEventListener('submit', handleComparisonSubmit);
    compareDifferentButton.addEventListener('click', handleCompareDifferent);
    themeToggle.addEventListener('change', handleThemeToggle);
    
    // Initialize theme from localStorage
    initTheme();
    
    /**
     * Initializes the theme from localStorage
     */
    function initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        themeToggle.checked = savedTheme === 'dark';
    }
    
    /**
     * Handles theme toggle changes
     */
    function handleThemeToggle() {
        const theme = themeToggle.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }
    
    /**
     * Handles the comparison form submission
     * @param {Event} e - The form submit event
     */
    async function handleComparisonSubmit(e) {
        e.preventDefault();
        
        // Validate inputs
        const url1 = urlInput1.value.trim();
        const url2 = urlInput2.value.trim();
        
        if (!url1 || !url2) {
            showError('Please enter both Amazon product URLs');
            return;
        }
        
        if (!isValidAmazonUrl(url1) || !isValidAmazonUrl(url2)) {
            showError('Please enter valid Amazon product URLs');
            return;
        }
        
        if (url1 === url2) {
            showError('Please enter two different product URLs');
            return;
        }
        
        showLoading();
        hideError();
        
        try {
            // Fetch product data for both products
            console.log('Fetching product 1 data...');
            const product1Result = await fetchProductData(url1, '1');
            
            if (!product1Result.success) {
                throw new Error(`Error fetching product 1: ${product1Result.error}`);
            }
            
            console.log('Fetching product 2 data...');
            const product2Result = await fetchProductData(url2, '2');
            
            if (!product2Result.success) {
                throw new Error(`Error fetching product 2: ${product2Result.error}`);
            }
            
            // Store the product data
            product1Data = product1Result.data;
            product2Data = product2Result.data;
            
            // Render basic product details
            renderProductDetails(product1Content, product1Data, '1');
            renderProductDetails(product2Content, product2Data, '2');
            
            // Generate and render the comparison analysis
            await generateComparisonAnalysis();
            
            // Show results
            showResults();
            resultsSection.classList.remove('hidden');
            window.scrollTo({
                top: resultsSection.offsetTop - 20,
                behavior: 'smooth'
            });
        } catch (error) {
            console.error('Error during comparison:', error);
            showError(`Error: ${error.message}`);
            hideLoading();
        }
    }
    
    /**
     * Fetches product data from the backend
     * @param {string} url - The Amazon product URL
     * @param {string} productIndex - The product index (1 or 2)
     * @returns {Promise<Object>} - Object with success status and data/error
     */
    async function fetchProductData(url, productIndex) {
        try {
            console.log(`Fetching data for product ${productIndex}...`);
            
            // First, call the server to generate the data
            const response = await fetch('/run-analysis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    url: url,
                    product_index: productIndex 
                })
            });
            
            if (!response.ok) {
                return { 
                    success: false, 
                    error: `Server error: ${response.status} ${response.statusText}` 
                };
            }
            
            const responseData = await response.json();
            
            if (!responseData.success) {
                return { 
                    success: false, 
                    error: responseData.error || 'Unknown server error' 
                };
            }
            
            // Now fetch the product data from the generated review_N.json file
            console.log(`Fetching the generated review_${productIndex}.json file...`);
            const productDataResponse = await fetch(`/review_${productIndex}.json`);
            
            if (!productDataResponse.ok) {
                return { 
                    success: false, 
                    error: `Failed to load product data file: ${productDataResponse.status}`
                };
            }
            
            const productData = await productDataResponse.json();
            console.log(`Product ${productIndex} data:`, productData);
            
            return { 
                success: true, 
                data: productData 
            };
            
        } catch (error) {
            console.error(`Error fetching product ${productIndex} data:`, error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }
    
    /**
     * Renders the basic product details in the specified column
     * @param {Element} container - The container element to render into
     * @param {Object} productData - The product data to render
     * @param {string} index - The product index (1 or 2)
     */
    function renderProductDetails(container, productData, index) {
        console.log(`Rendering product ${index} details:`, productData);
        
        if (!container) {
            console.error(`Container element for product ${index} not found`);
            return;
        }
        
        if (!productData) {
            console.error(`Product data for product ${index} is missing`);
            return;
        }
        
        // Clear existing content
        container.innerHTML = '';
        
        // Extract product details
        const productDetails = productData.product_details || {};
        const title = productDetails.title || `Product ${index}`;
        const price = productDetails.price || 'Price not available';
        const rating = productData.review_data?.analysis?.average_rating || 'N/A';
        const imageUrl = productDetails.image_url || ''; 
        const productUrl = productDetails.url || '#';
        
        // Create product card content
        const productHTML = `
            <div class="product-header">
                ${imageUrl ? `<img src="${imageUrl}" alt="${title}" class="product-image">` : ''}
                <div class="product-info">
                    <h3 class="product-title"><a href="${productUrl}" target="_blank">${title}</a></h3>
                    <div class="product-price">${price}</div>
                    <div class="product-rating">Rating: ${rating} ★</div>
                </div>
            </div>
            <div class="product-description">
                ${productDetails.description || 'No description available'}
            </div>
        `;
        
        container.innerHTML = productHTML;
    }
    
    /**
     * Generates comparison analysis between the two products
     */
    async function generateComparisonAnalysis() {
        if (!product1Data || !product2Data) {
            console.error('Missing product data for comparison');
            return;
        }
        
        // Set up specification comparison table
        renderSpecificationComparison();
        
        try {
            console.log('Generating comparison analysis with DeepSeek...');
            // Run the comparison analysis using the DeepSeek API
            const response = await fetch('/run-comparison-analysis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    product_A: product1Data,
                    product_B: product2Data
                })
            });
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }
            
            // Parse the response JSON
            const result = await response.json();
            console.log('DeepSeek API response:', result);
            
            // Check if the response contains an error
            if (result.error) {
                throw new Error(`API error: ${result.error}`);
            }
            
            // If the response is successful but doesn't have the expected structure
            if (!result.product_advantages && !result.critical_weaknesses) {
                console.warn('DeepSeek response missing expected structure:', result);
                
                // Use the result directly if it has the right structure
                if (typeof result === 'object' && result !== null) {
                    comparisonData = result;
                } else {
                    // Create a placeholder response
                    comparisonData = {
                        product_advantages: [],
                        critical_weaknesses: [],
                        shared_strengths: [],
                        unique_selling_points: {
                            product_A: [],
                            product_B: []
                        },
                        buyer_recommendation: "No recommendation available."
                    };
                }
            } else {
                // Use the result data directly
                comparisonData = result;
            }
            
            // Render the comparison results
            renderComparisonResults(comparisonData);
            
        } catch (error) {
            console.error('Error generating comparison analysis:', error);
            
            // Create a placeholder response for display purposes
            comparisonData = {
                product_advantages: [
                    {
                        feature: "Price",
                        better_product: product1Data.product_details?.price < product2Data.product_details?.price ? "A" : "B",
                        summary: "Lower price point",
                        quote: ""
                    }
                ],
                critical_weaknesses: [],
                shared_strengths: ["Both products have similar core features"],
                unique_selling_points: {
                    product_A: ["Features of product 1"],
                    product_B: ["Features of product 2"]
                },
                buyer_recommendation: "Could not generate a comprehensive comparison due to an error."
            };
            
            // Still render the basic comparison
            renderComparisonResults(comparisonData);
            
            // Show error but don't block the UI
            showError(`Error generating AI comparison: ${error.message}. Basic comparison shown instead.`);
        } finally {
            hideLoading();
        }
    }
    
    /**
     * Renders the specification comparison table
     */
    function renderSpecificationComparison() {
        if (!product1Data || !product2Data) return;
        
        // Extract specifications from both products
        const specs1 = extractSpecifications(product1Data);
        const specs2 = extractSpecifications(product2Data);
        
        // Find matching keys (specs present in both products)
        const matchingKeys = Object.keys(specs1).filter(key => key in specs2);
        
        // If there are no matching specs, display a message
        if (matchingKeys.length === 0) {
            specsComparisonTable.innerHTML = '<p>No matching specifications found to compare.</p>';
            return;
        }
        
        // Create the table HTML
        let tableHTML = `
            <table class="specs-comparison-table">
                <thead>
                    <tr>
                        <th>Specification</th>
                        <th>Product 1</th>
                        <th>Product 2</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        // Add rows for each matching specification
        matchingKeys.forEach(key => {
            const value1 = specs1[key];
            const value2 = specs2[key];
            
            // Check if values are different to highlight them
            const isDifferent = value1 !== value2;
            const rowClass = isDifferent ? 'highlight-diff' : '';
            
            // Try to determine which is better for numeric values
            const isBetter1 = isBetterValue(value1, value2, key);
            const isBetter2 = isBetterValue(value2, value1, key);
            
            const value1Class = isBetter1 ? 'better-value' : '';
            const value2Class = isBetter2 ? 'better-value' : '';
            
            tableHTML += `
                <tr class="${rowClass}">
                    <td>${key}</td>
                    <td class="${value1Class}">${value1}</td>
                    <td class="${value2Class}">${value2}</td>
                </tr>
            `;
        });
        
        // Close the table
        tableHTML += `
                </tbody>
            </table>
        `;
        
        // Add the table to the page
        specsComparisonTable.innerHTML = tableHTML;
    }
    
    /**
     * Determines if valueA is better than valueB for a given specification
     * @param {string} valueA - First value to compare
     * @param {string} valueB - Second value to compare
     * @param {string} specKey - The specification key being compared
     * @returns {boolean} - Whether valueA is better than valueB
     */
    function isBetterValue(valueA, valueB, specKey) {
        // For pricing, lower is better
        if (specKey.toLowerCase().includes('price')) {
            const priceA = extractPriceValue(valueA);
            const priceB = extractPriceValue(valueB);
            return priceA > 0 && priceB > 0 && priceA < priceB;
        }
        
        // For ratings, higher is better
        if (specKey.toLowerCase().includes('rating')) {
            const ratingA = parseFloat(valueA);
            const ratingB = parseFloat(valueB);
            return !isNaN(ratingA) && !isNaN(ratingB) && ratingA > ratingB;
        }
        
        // For memory/storage/capacity, higher is usually better
        if (specKey.toLowerCase().includes('storage') || 
            specKey.toLowerCase().includes('memory') || 
            specKey.toLowerCase().includes('capacity') ||
            specKey.toLowerCase().includes('ram')) {
            const numA = extractNumericValue(valueA);
            const numB = extractNumericValue(valueB);
            return numA > numB;
        }
        
        return false;
    }
    
    /**
     * Extracts a numeric value from a string
     * @param {string} value - The string to extract from
     * @returns {number} - The extracted numeric value or 0
     */
    function extractNumericValue(value) {
        if (!value) return 0;
        
        const match = value.match(/(\d+(\.\d+)?)/);
        if (match) {
            return parseFloat(match[0]);
        }
        
        return 0;
    }
    
    /**
     * Extract specifications from product data
     * @param {Object} productData - The product data
     * @returns {Object} - Key-value pairs of specifications
     */
    function extractSpecifications(productData) {
        const specs = {};
        
        // Extract from product details and feature bullets
        if (productData.product_details) {
            // Add basic specs like brand, model, etc.
            if (productData.product_details.brand) {
                specs['Brand'] = productData.product_details.brand;
            }
            
            // Add dimensions if available
            if (productData.product_details.dimensions) {
                specs['Dimensions'] = productData.product_details.dimensions;
            }
            
            // Add weight if available
            if (productData.product_details.weight) {
                specs['Weight'] = productData.product_details.weight;
            }
        }
        
        // Extract from feature bullets if available
        if (productData.product_details && productData.product_details.feature_bullets) {
            productData.product_details.feature_bullets.forEach((bullet, index) => {
                // Try to extract key-value pairs from feature bullets
                const match = bullet.match(/^([^:]+):\s*(.+)$/);
                if (match) {
                    specs[match[1].trim()] = match[2].trim();
                } else if (bullet.includes(':')) {
                    const parts = bullet.split(':');
                    specs[parts[0].trim()] = parts.slice(1).join(':').trim();
                }
            });
        }
        
        // Add review stats
        if (productData.review_data && productData.review_data.analysis) {
            specs['Average Rating'] = productData.review_data.analysis.average_rating || 'N/A';
            specs['Total Reviews'] = productData.review_data.total_reviews || 'N/A';
        }
        
        // Add price
        if (productData.product_details && productData.product_details.price) {
            specs['Price'] = productData.product_details.price;
        }
        
        return specs;
    }
    
    /**
     * Renders the comparison results
     * @param {Object} comparisonData - The comparison data
     */
    function renderComparisonResults(comparisonData) {
        if (!comparisonData) {
            console.error('No comparison data available');
            return;
        }
        
        console.log('Rendering comparison results:', comparisonData);
        
        // Render product advantages
        renderProductAdvantages(comparisonData.product_advantages || []);
        
        // Render critical weaknesses
        renderCriticalWeaknesses(comparisonData.critical_weaknesses || []);
        
        // Render shared strengths
        renderSharedStrengths(comparisonData.shared_strengths || []);
        
        // Render unique selling points
        renderUniqueSellingPoints(comparisonData.unique_selling_points || {});
        
        // Render buyer recommendation
        renderBuyerRecommendation(comparisonData.buyer_recommendation || '');
    }
    
    /**
     * Renders the product advantages section
     * @param {Array} advantages - The product advantages
     */
    function renderProductAdvantages(advantages) {
        if (!advantages || advantages.length === 0) {
            productAdvantagesEl.innerHTML = '<p>No significant advantages found between the products.</p>';
            return;
        }
        
        let html = '<div class="advantage-items">';
        
        advantages.forEach(advantage => {
            const winner = advantage.better_product === 'A' ? 'Product 1' : 'Product 2';
            const winnerClass = advantage.better_product === 'A' ? 'winner-a' : 'winner-b';
            
            html += `
                <div class="advantage-item ${winnerClass}">
                    <div class="advantage-header">
                        <span class="advantage-feature">${advantage.feature}</span>
                        <span class="advantage-winner">Winner: ${winner}</span>
                    </div>
                    <div class="advantage-summary">${advantage.summary}</div>
                    ${advantage.quote ? `<div class="advantage-quote">"${advantage.quote}"</div>` : ''}
                </div>
            `;
        });
        
        html += '</div>';
        productAdvantagesEl.innerHTML = html;
    }
    
    /**
     * Renders the critical weaknesses section
     * @param {Array} weaknesses - The critical weaknesses
     */
    function renderCriticalWeaknesses(weaknesses) {
        if (!weaknesses || weaknesses.length === 0) {
            criticalWeaknessesEl.innerHTML = '<p>No critical weaknesses found in either product.</p>';
            return;
        }
        
        let html = '<div class="weakness-items">';
        
        weaknesses.forEach(weakness => {
            const loser = weakness.worse_product === 'A' ? 'Product 1' : 'Product 2';
            const severityClass = `severity-${weakness.severity.toLowerCase()}`;
            
            html += `
                <div class="weakness-item">
                    <div class="weakness-header">
                        <span class="weakness-feature">${weakness.feature}</span>
                        <span class="weakness-product">${loser}</span>
                        <span class="weakness-severity ${severityClass}">${weakness.severity}</span>
                    </div>
                    <div class="weakness-issue">${weakness.issue}</div>
                </div>
            `;
        });
        
        html += '</div>';
        criticalWeaknessesEl.innerHTML = html;
    }
    
    /**
     * Renders the shared strengths section
     * @param {Array} strengths - The shared strengths
     */
    function renderSharedStrengths(strengths) {
        if (!strengths || strengths.length === 0) {
            sharedStrengthsEl.innerHTML = '<p>No shared strengths found between the products.</p>';
            return;
        }
        
        let html = '<ul class="shared-strengths-list">';
        
        strengths.forEach(strength => {
            html += `<li>${strength}</li>`;
        });
        
        html += '</ul>';
        sharedStrengthsEl.innerHTML = html;
    }
    
    /**
     * Renders the unique selling points section
     * @param {Object} sellingPoints - The unique selling points
     */
    function renderUniqueSellingPoints(sellingPoints) {
        if (!sellingPoints || ((!sellingPoints.product_A || sellingPoints.product_A.length === 0) && 
                              (!sellingPoints.product_B || sellingPoints.product_B.length === 0))) {
            uniqueSellingPointsEl.innerHTML = '<p>No unique selling points found for either product.</p>';
            return;
        }
        
        let html = `
            <div class="selling-points-container">
                <div class="selling-points-column">
                    <h4>Product 1</h4>
                    ${renderSellingPointsList(sellingPoints.product_A || [])}
                </div>
                <div class="selling-points-column">
                    <h4>Product 2</h4>
                    ${renderSellingPointsList(sellingPoints.product_B || [])}
                </div>
            </div>
        `;
        
        uniqueSellingPointsEl.innerHTML = html;
    }
    
    /**
     * Renders a list of selling points
     * @param {Array} points - The selling points
     * @returns {string} - HTML string
     */
    function renderSellingPointsList(points) {
        if (!points || points.length === 0) {
            return '<p>None found</p>';
        }
        
        let html = '<ul class="selling-points-list">';
        
        points.forEach(point => {
            html += `<li>${point}</li>`;
        });
        
        html += '</ul>';
        return html;
    }
    
    /**
     * Renders the buyer recommendation section
     * @param {string} recommendation - The buyer recommendation
     */
    function renderBuyerRecommendation(recommendation) {
        if (!recommendation) {
            buyerRecommendationEl.innerHTML = '<p>No specific buyer recommendation available.</p>';
            return;
        }
        
        buyerRecommendationEl.innerHTML = `
            <div class="recommendation-content">
                <i class="fas fa-shopping-cart recommendation-icon"></i>
                <p>${recommendation}</p>
            </div>
        `;
    }
    
    /**
     * Extract a numeric price value from a price string
     * @param {string} priceStr - The price string (e.g., '$99.99')
     * @returns {number} - The price as a number
     */
    function extractPriceValue(priceStr) {
        if (!priceStr) return 0;
        
        // Extract digits and decimal point
        const match = priceStr.match(/[$£€]?([0-9,]+\.?[0-9]*)/);
        if (match) {
            // Remove commas and convert to float
            return parseFloat(match[1].replace(/,/g, ''));
        }
        
        return 0;
    }
    
    /**
     * Validates if a URL is an Amazon product URL
     * @param {string} url - The URL to validate
     * @returns {boolean} - Whether the URL is valid
     */
    function isValidAmazonUrl(url) {
        return url.includes('amazon.com') && (url.includes('/dp/') || url.includes('/product/'));
    }
    
    /**
     * Handles the "Compare Different Products" button click
     */
    function handleCompareDifferent() {
        // Hide results and show form
        comparisonResultsContainer.classList.add('hidden');
        urlInput1.value = '';
        urlInput2.value = '';
        
        // Scroll to form
        window.scrollTo({
            top: comparisonForm.offsetTop - 20,
            behavior: 'smooth'
        });
        
        // Set focus on first input
        urlInput1.focus();
    }
    
    /**
     * Shows the loading spinner
     */
    function showLoading() {
        loadingSpinner.classList.remove('hidden');
    }
    
    /**
     * Hides the loading spinner
     */
    function hideLoading() {
        loadingSpinner.classList.add('hidden');
    }
    
    /**
     * Shows the results section
     */
    function showResults() {
        comparisonResultsContainer.classList.remove('hidden');
    }
    
    /**
     * Shows an error message
     * @param {string} message - The error message to show
     */
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
        hideLoading();
    }
    
    /**
     * Hides the error message
     */
    function hideError() {
        errorMessage.classList.add('hidden');
    }
}); 