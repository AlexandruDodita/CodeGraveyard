/**
 * Enhanced HTTP server for local development
 * Includes an endpoint to run the Python backend script
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { exec } = require('child_process');
const querystring = require('querystring');
const { spawn } = require('child_process');

// Port to run the server on
const PORT = 8000;

// MIME types for different file extensions
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

/**
 * Runs the Python backend script to analyze the product URL
 * @param {string} productUrl - The Amazon product URL to analyze
 * @param {string} outputFile - The output file name for the analysis result
 * @returns {Promise<Object>} - Response object with success status and any error
 */
function runPythonScript(productUrl, outputFile) {
  return new Promise((resolve, reject) => {
    const command = `python main.py "${productUrl}" -o ${outputFile}`;
    console.log(`Executing: ${command}`);
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error running Python script: ${error.message}`);
        console.error(`stderr: ${stderr}`);
        console.error(`stdout: ${stdout}`);
        
        // Check for specific error types from Python output
        if (stderr.includes('blocked by Amazon') || stderr.includes('could not extract data')) {
          return resolve({ 
            success: false, 
            error: `No data scraped from Amazon. They might be blocking our requests. Please try again later.`
          });
        }
        
        // Return more detailed error information for debugging
        return resolve({ 
          success: false, 
          error: `Failed to analyze URL. Details: ${stderr || error.message || 'Unknown error'}`
        });
      }
      
      // Check if the Python script produced empty or invalid JSON
      try {
        const reviewJsonPath = path.join(__dirname, '..', outputFile);
        const reviewData = fs.readFileSync(reviewJsonPath, 'utf8');
        const jsonData = JSON.parse(reviewData);
        
        // Check if the data has minimum required fields
        if (!jsonData.product_details || !jsonData.product_details.description) {
          console.log('Empty or invalid product data detected:', JSON.stringify(jsonData, null, 2));
          return resolve({
            success: false,
            error: 'No data scraped from Amazon. They might be blocking our requests. Please try again later.'
          });
        }
        
        console.log(`Python script completed successfully`);
        resolve({ success: true, output: stdout });
      } catch (jsonError) {
        console.error(`Error reading/parsing review.json: ${jsonError.message}`);
        resolve({
          success: false,
          error: 'Failed to parse product data. Amazon may be blocking our requests.'
        });
      }
    });
  });
}

/**
 * Parses the request body for POST requests
 * @param {http.IncomingMessage} req - The HTTP request
 * @returns {Promise<Object>} - The parsed request body
 */
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        if (body) {
          resolve(JSON.parse(body));
        } else {
          resolve({});
        }
      } catch (error) {
        reject(error);
      }
    });
    
    req.on('error', error => {
      reject(error);
    });
  });
}

/**
 * Runs the DeepSeek AI analysis script
 * @returns {Promise<Object>} The analysis results
 */
function runDeepSeekAnalysis() {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'python', 'deepseek_api.py');
    const responsePath = path.join(__dirname, '..', 'response.json');
    
    console.log(`Running DeepSeek Analysis script: ${scriptPath}`);
    
    // Run the Python script
    exec(`python "${scriptPath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`DeepSeek Analysis error: ${error.message}`);
        console.error(`stderr: ${stderr}`);
        
        // Try to read response.json anyway, as the script might have saved partial results
        try {
          const responseData = fs.readFileSync(responsePath, 'utf8');
          const analysisResults = JSON.parse(responseData);
          
          if (analysisResults.error) {
            // If there's an error but we have structured data, return it
            console.log("Found error response in response.json, returning it");
            return resolve(analysisResults);
          }
        } catch (readErr) {
          // Ignore read errors and fall through to the normal error handling
        }
        
        return reject(new Error('Failed to run DeepSeek analysis: ' + error.message));
      }
      
      console.log(`DeepSeek Analysis stdout: ${stdout}`);
      
      // Check if stderr contains non-empty output
      if (stderr && stderr.trim() !== '') {
        console.warn(`DeepSeek Analysis warnings: ${stderr}`);
      }
      
      // Check if response file exists and read it
      fs.readFile(responsePath, 'utf8', (readErr, data) => {
        if (readErr) {
          console.error(`Error reading response.json: ${readErr.message}`);
          return reject(new Error('Failed to read analysis results'));
        }
        
        try {
          const analysisResults = JSON.parse(data);
          resolve(analysisResults);
        } catch (parseErr) {
          console.error(`Error parsing response.json: ${parseErr.message}`);
          reject(new Error('Failed to parse analysis results'));
        }
      });
    });
  });
}

// Create the HTTP server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url);
  const pathname = parsedUrl.pathname;
  
  // Enable CORS for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS requests for CORS preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204; // No content
    res.end();
    return;
  }
  
  // Handle the run-analysis endpoint to run the Python script
  if (pathname === '/run-analysis' && req.method === 'POST') {
    try {
      const body = await parseRequestBody(req);
      
      if (!body.url) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'No URL provided' }));
        return;
      }
      
      // Check if this is for comparison (optional product_index parameter)
      const productIndex = body.product_index || '';
      const outputFile = productIndex ? `review_${productIndex}.json` : 'review.json';
      
      // Run the Python script to analyze the URL
      const result = await runPythonScript(body.url, outputFile);
      
      res.statusCode = result.success ? 200 : 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
      return;
    } catch (error) {
      console.error('Error processing request:', error);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        success: false, 
        error: `Server error: ${error.message}` 
      }));
      return;
    }
  }
  
  // Handle the run-deepseek-analysis endpoint to run the DeepSeek script
  if (pathname === '/run-deepseek-analysis' && req.method === 'POST') {
    // Handle DeepSeek analysis request
    runDeepSeekAnalysis()
      .then(result => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      })
      .catch(error => {
        console.error(`Error in DeepSeek analysis: ${error.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      });
    return;
  }
  
  // Handle the new comparison endpoint
  if (pathname === '/run-comparison-analysis' && req.method === 'POST') {
    try {
      const body = await parseRequestBody(req);
      console.log('Received request for comparison analysis');
      
      if (!body.product_A || !body.product_B) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: false,
          error: 'Both products are required for comparison'
        }));
        return;
      }
      
      // Create a temporary file to store the comparison prompt data
      const comparisonDataPath = path.join(__dirname, 'comparison_data.json');
      fs.writeFileSync(comparisonDataPath, JSON.stringify(body, null, 2));
      console.log('Saved comparison data to comparison_data.json');

      // Generate the comparison prompt
      const comparisonPrompt = generateComparisonPrompt(body.product_A, body.product_B);
      
      // Save the prompt to a file for debugging
      const promptPath = path.join(__dirname, 'comparison_prompt.txt');
      fs.writeFileSync(promptPath, comparisonPrompt);
      console.log('Saved comparison prompt to comparison_prompt.txt');

      // Check if the comparison_analyzer.py exists, if not create it
      const scriptPath = path.join(__dirname, 'python', 'comparison_analyzer.py');
      if (!fs.existsSync(scriptPath)) {
        console.log('Creating comparison_analyzer.py script');
        ensureComparisonAnalyzerScript();
      }
      
      console.log('Running comparison analysis with DeepSeek API');
      const python = process.platform === 'win32' ? 'python' : 'python3';
      
      // Run the comparison script directly (synchronously for simplicity)
      const { error, status, stdout, stderr } = require('child_process').spawnSync(
        python, 
        [scriptPath], 
        { encoding: 'utf8' }
      );
      
      if (error) {
        console.error('Error running comparison script:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: false,
          error: 'Failed to run comparison analysis script: ' + error.message
        }));
        return;
      }
      
      if (status !== 0) {
        console.error('Comparison script returned non-zero status:', status);
        console.error('stderr:', stderr);
        console.error('stdout:', stdout);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: false,
          error: 'Comparison analysis script failed with status ' + status
        }));
        return;
      }
      
      console.log('Comparison analysis completed successfully');
      console.log('stdout:', stdout);
      
      // Try to read the result file
      const resultPath = path.join(__dirname, 'comparison_result.json');
      if (fs.existsSync(resultPath)) {
        try {
          console.log('Reading comparison_result.json');
          const resultData = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(resultData));
          return;
        } catch (parseError) {
          console.error('Error parsing comparison result:', parseError);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: false,
            error: 'Failed to parse comparison result: ' + parseError.message
          }));
          return;
        }
      } else {
        // Try to parse the output directly
        try {
          console.log('Trying to parse stdout as JSON');
          const jsonMatch = stdout.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const analysisData = JSON.parse(jsonMatch[0]);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(analysisData));
            return;
          }
        } catch (parseError) {
          console.error('Error parsing stdout as JSON:', parseError);
        }
        
        console.error('No comparison_result.json file found and could not parse stdout');
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: false,
          error: 'No comparison result generated'
        }));
        return;
      }
    } catch (error) {
      console.error('Error in comparison analysis endpoint:', error);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: false,
        error: 'Internal server error: ' + error.message
      }));
    }
    return;
  }
  
  // Handle static file requests
  // Get the path from the URL
  let filePath = path.join(__dirname, '..', parsedUrl.pathname);
  
  // Default to index.html if path is a directory
  if (pathname === '/' || pathname === '') {
    filePath = path.join(__dirname, '..', 'pages/index.html');
  } else if (filePath.endsWith('/')) {
    filePath = path.join(filePath, 'index.html');
  }
  
  // Get the file extension
  const ext = path.extname(filePath);
  
  // Check if the file exists
  fs.stat(filePath, (err, stat) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // File not found
        res.statusCode = 404;
        res.end(`File ${filePath} not found!`);
        return;
      }
      
      // Other server error
      res.statusCode = 500;
      res.end(`Error checking for file: ${err.code}`);
      return;
    }
    
    // If it's a directory, redirect to index.html
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    
    // Read the file
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.statusCode = 500;
        res.end(`Error reading file: ${err.code}`);
        return;
      }
      
      // Set the content type based on file extension
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      
      // Send the file data
      res.end(data);
    });
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`
========================================
🚀 Amazon Product Analyzer Server 🚀
========================================

Server started at http://localhost:${PORT}

To view the application:
👉 http://localhost:${PORT}/pages/index.html

API Endpoints:
- POST /run-analysis - Run the Python script with an Amazon URL
- POST /run-deepseek-analysis - Run the DeepSeek analysis script
- POST /run-comparison-analysis - Run product comparison analysis

Press Ctrl+C to stop the server
  `);
});

/**
 * Generates the comparison prompt for DeepSeek
 * @param {Object} productA - Product A data
 * @param {Object} productB - Product B data
 * @returns {string} The formatted prompt
 */
function generateComparisonPrompt(productA, productB) {
  const productATitle = productA.product_details?.description || 'Product A';
  const productBTitle = productB.product_details?.description || 'Product B';
  
  // Format product A reviews
  const productAReviews = formatReviewsForPrompt(productA.review_data?.reviews || []);
  
  // Format product B reviews
  const productBReviews = formatReviewsForPrompt(productB.review_data?.reviews || []);
  
  // Create the prompt
  return `You are an intelligent assistant comparing two similar Amazon products based on customer feedback and product data. Your goal is to extract clear, actionable differences that help a seller:

    Position their product better
    Understand competitive weaknesses
    Identify features to emphasize, improve, or de-emphasize

PRODUCT A: ${productATitle}
Price: ${productA.product_details?.price || 'N/A'}
Average Rating: ${productA.review_data?.analysis?.average_rating || 'N/A'}
Specifications: ${JSON.stringify(productA.product_details?.specifications || {})}

PRODUCT A REVIEWS:
${productAReviews}

PRODUCT B: ${productBTitle}
Price: ${productB.product_details?.price || 'N/A'}
Average Rating: ${productB.review_data?.analysis?.average_rating || 'N/A'}
Specifications: ${JSON.stringify(productB.product_details?.specifications || {})}

PRODUCT B REVIEWS:
${productBReviews}

Output a structured JSON with the following schema
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
If a product is better for a certain audience or use case, highlight that in the buyer_recommendation`;
}

/**
 * Formats reviews for the comparison prompt
 * @param {Array} reviews - The reviews array
 * @returns {string} Formatted reviews text
 */
function formatReviewsForPrompt(reviews) {
  if (!reviews || reviews.length === 0) {
    return 'No reviews available.';
  }
  
  // Limit to 5 reviews to keep prompt size reasonable
  const limitedReviews = reviews.slice(0, 5);
  
  return limitedReviews.map(review => {
    return `Review by ${review.reviewer_name || 'Anonymous'} (${review.rating} stars):
${review.text?.substring(0, 300) || 'No text'} ${review.text?.length > 300 ? '...' : ''}`;
  }).join('\n\n');
}

/**
 * Parses DeepSeek output to extract JSON
 * @param {string} output - Raw output from DeepSeek
 * @returns {Object} Parsed JSON data
 */
function parseDeepSeekOutput(output) {
  try {
    // Try to extract JSON from the output
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // Default return if no JSON is found
    return {
      product_advantages: [],
      critical_weaknesses: [],
      shared_strengths: [],
      unique_selling_points: {
        product_A: [],
        product_B: []
      },
      buyer_recommendation: "Could not generate recommendation"
    };
  } catch (error) {
    console.error('Error parsing DeepSeek output:', error);
    return {
      parse_error: true,
      raw_output: output
    };
  }
}

/**
 * Ensures the comparison analyzer Python script exists
 */
function ensureComparisonAnalyzerScript() {
  const scriptPath = path.join(__dirname, 'python', 'comparison_analyzer.py');
  
  // Check if the file already exists
  if (fs.existsSync(scriptPath)) {
    return;
  }
  
  // Create the Python directory if it doesn't exist
  const pythonDir = path.join(__dirname, 'python');
  if (!fs.existsSync(pythonDir)) {
    fs.mkdirSync(pythonDir, { recursive: true });
  }
  
  // Python script content for comparison analyzer
  const scriptContent = `
import json
import os
import requests
from pathlib import Path

# DeepSeek API configuration
API_KEY = "YOUR_DEEPSEEK_API_KEY"
API_URL = "https://api.deepseek.com/v1/chat/completions"

def load_comparison_data():
    """Load the product comparison data"""
    script_dir = Path(__file__).parent.parent
    data_path = script_dir / "comparison_data.json"
    
    if not data_path.exists():
        return None
    
    with open(data_path, "r", encoding="utf-8") as f:
        return json.load(f)

def load_prompt():
    """Load the comparison prompt"""
    script_dir = Path(__file__).parent.parent
    prompt_path = script_dir / "comparison_prompt.txt"
    
    if not prompt_path.exists():
        return None
    
    with open(prompt_path, "r", encoding="utf-8") as f:
        return f.read()

def get_deepseek_analysis(prompt):
    """Call DeepSeek API to get analysis"""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }
    
    data = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": "You are a helpful product comparison assistant."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.3,
        "max_tokens": 2048
    }
    
    try:
        response = requests.post(API_URL, headers=headers, json=data)
        response.raise_for_status()
        result = response.json()
        return result["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"Error calling DeepSeek API: {e}")
        return None

def save_response(response, output_path):
    """Save the response to a file"""
    with open(output_path, "w", encoding="utf-8") as f:
        if response.startswith("{") and response.endswith("}"):
            # Direct JSON response
            f.write(response)
        else:
            # Try to extract JSON
            import re
            json_match = re.search(r'\\{.*\\}', response, re.DOTALL)
            if json_match:
                f.write(json_match.group(0))
            else:
                # Couldn't extract JSON, save as is
                f.write(response)

def main():
    """Main function to run comparison analysis"""
    comparison_data = load_comparison_data()
    prompt = load_prompt()
    
    if not comparison_data or not prompt:
        print(json.dumps({"error": "Missing input data"}))
        return
    
    analysis = get_deepseek_analysis(prompt)
    
    if not analysis:
        print(json.dumps({"error": "Failed to get DeepSeek analysis"}))
        return
    
    # Process the response to extract JSON
    try:
        # Try to parse the response as JSON
        json_data = json.loads(analysis)
        output_data = json_data
    except json.JSONDecodeError:
        # Not valid JSON, try to extract JSON from text
        import re
        json_match = re.search(r'\\{.*\\}', analysis, re.DOTALL)
        if json_match:
            try:
                output_data = json.loads(json_match.group(0))
            except:
                output_data = {"raw_response": analysis}
        else:
            output_data = {"raw_response": analysis}
    
    script_dir = Path(__file__).parent.parent
    output_path = script_dir / "comparison_result.json"
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2)
    
    print(json.dumps(output_data))

if __name__ == "__main__":
    main()
`;

  // Write the script file
  fs.writeFileSync(scriptPath, scriptContent);
} 