import logging
import json
from typing import List, Dict, Any, Optional
import re
import random

class ReviewSummarizer:
    """
    A class to generate AI-powered summaries from Amazon product reviews.
    This is a placeholder implementation that will be replaced with actual
    Gemini API calls in production.
    """
    
    def __init__(self, api_key: str = None):
        """
        Initialize the review summarizer.
        
        Args:
            api_key (str, optional): API key for the AI service.
        """
        self.api_key = api_key
        self.logger = logging.getLogger(__name__)
    
    def generate_summary(self, reviews: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Generate a summary from a list of reviews.
        
        Args:
            reviews (List[Dict[str, Any]]): List of review dictionaries.
            
        Returns:
            Dict[str, Any]: Generated summary data.
        """
        if not reviews:
            return {
                'summary': "No reviews available for this product.",
                'key_points': [],
                'pros': [],
                'cons': [],
                'sentiment': "neutral"
            }
        
        self.logger.info(f"Generating summary for {len(reviews)} reviews")
        
        # In a real implementation, this would call the Gemini API
        # For now, we'll create a placeholder implementation
        
        # Extract the text content from reviews for processing
        review_texts = [review['text'] for review in reviews if review['text']]
        review_titles = [review['title'] for review in reviews if review['title']]
        
        # Calculate average rating
        avg_rating = sum(review['rating'] for review in reviews) / len(reviews)
        
        # Generate placeholder summary based on rating
        summary = self._generate_placeholder_summary(reviews, avg_rating)
        
        # Extract key points, pros and cons
        key_points = self._extract_key_points(review_texts, review_titles)
        pros, cons = self._extract_pros_cons(review_texts, review_titles, avg_rating)
        
        # Determine overall sentiment
        sentiment = "positive" if avg_rating >= 4.0 else "neutral" if avg_rating >= 3.0 else "negative"
        
        return {
            'summary': summary,
            'key_points': key_points,
            'pros': pros,
            'cons': cons,
            'sentiment': sentiment
        }
    
    def _generate_placeholder_summary(self, reviews: List[Dict[str, Any]], avg_rating: float) -> str:
        """Generate a placeholder summary based on reviews and rating."""
        # Count verified purchases
        verified_count = sum(1 for review in reviews if review['verified_purchase'])
        verified_percentage = (verified_count / len(reviews)) * 100 if reviews else 0
        
        # Get the most common words from review titles (excluding stop words)
        title_text = " ".join([review['title'] for review in reviews if review['title']])
        common_words = self._extract_common_words(title_text, exclude_words=[
            "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "with", 
            "about", "is", "are", "was", "were", "be", "this", "that", "it", "of"
        ])
        
        # Structure based on rating
        if avg_rating >= 4.5:
            return f"Customers are highly satisfied with this product, giving it an average rating of {avg_rating:.1f} stars. {verified_percentage:.0f}% of reviews are from verified purchases. Users frequently mention {', '.join(common_words[:3])} in their reviews. The product appears to meet or exceed expectations in terms of quality and functionality."
        elif avg_rating >= 4.0:
            return f"This product is well-received with an average rating of {avg_rating:.1f} stars. {verified_percentage:.0f}% of reviews come from verified purchases. Reviewers often highlight {', '.join(common_words[:3])}. While there are some minor concerns, most customers find the product satisfactory."
        elif avg_rating >= 3.0:
            return f"This product has mixed reviews with an average rating of {avg_rating:.1f} stars. {verified_percentage:.0f}% of reviews are from verified purchases. Common themes include {', '.join(common_words[:3])}. The product meets basic expectations but has several areas for improvement."
        else:
            return f"This product has received predominantly negative reviews with an average of {avg_rating:.1f} stars. {verified_percentage:.0f}% of reviews are from verified purchases. Customers frequently mention issues with {', '.join(common_words[:3])}. Many users report disappointment with their purchase."
    
    def _extract_common_words(self, text: str, exclude_words: List[str] = None, limit: int = 5) -> List[str]:
        """Extract the most common meaningful words from text."""
        if not text:
            return []
            
        exclude_words = exclude_words or []
        
        # Convert to lowercase and split into words
        words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
        
        # Remove excluded words
        filtered_words = [word for word in words if word not in exclude_words]
        
        # Count word frequency
        word_counts = {}
        for word in filtered_words:
            word_counts[word] = word_counts.get(word, 0) + 1
        
        # Sort by frequency
        sorted_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)
        
        # Return the most common words
        return [word for word, count in sorted_words[:limit]]
    
    def _extract_key_points(self, review_texts: List[str], review_titles: List[str]) -> List[str]:
        """Extract key points from review texts and titles."""
        # This is a placeholder. In a real implementation, this would use 
        # the AI model to extract key points.
        
        if not review_texts:
            return []
        
        # Some placeholder key points based on common review topics
        potential_points = [
            "Product quality is mentioned in many reviews.",
            "Ease of use is a common theme.",
            "Value for money is frequently discussed.",
            "Durability appears to be important to reviewers.",
            "Customer service experience is mentioned by some users.",
            "Shipping and delivery are noted in several reviews.",
            "Product appearance and design are highlighted.",
            "Functionality meets expectations according to most users.",
            "Size and dimensions are mentioned in multiple reviews.",
            "Instructions and documentation are discussed by some reviewers."
        ]
        
        # Randomly select 3-5 key points
        num_points = min(random.randint(3, 5), len(potential_points))
        return random.sample(potential_points, num_points)
    
    def _extract_pros_cons(self, 
                           review_texts: List[str], 
                           review_titles: List[str], 
                           avg_rating: float) -> tuple[List[str], List[str]]:
        """Extract pros and cons from review texts and titles."""
        # This is a placeholder. In a real implementation, this would use 
        # the AI model to identify pros and cons.
        
        pros = []
        cons = []
        
        # Some placeholder pros and cons
        potential_pros = [
            "Good value for money",
            "High-quality materials",
            "Easy to use",
            "Durable construction",
            "Excellent customer service",
            "Fast shipping",
            "Attractive design",
            "Functions as advertised",
            "Good size/dimensions",
            "Clear instructions"
        ]
        
        potential_cons = [
            "Higher price than alternatives",
            "Quality issues reported",
            "Difficult to use for some users",
            "Durability concerns",
            "Customer service issues mentioned",
            "Shipping delays noted",
            "Design limitations",
            "Limited functionality",
            "Size not as expected",
            "Unclear instructions"
        ]
        
        # Select pros and cons based on average rating
        if avg_rating >= 4.0:
            # More pros than cons for highly rated products
            num_pros = random.randint(3, 5)
            num_cons = random.randint(1, 2)
        elif avg_rating >= 3.0:
            # Balanced pros and cons for average rated products
            num_pros = random.randint(2, 4)
            num_cons = random.randint(2, 4)
        else:
            # More cons than pros for poorly rated products
            num_pros = random.randint(1, 2)
            num_cons = random.randint(3, 5)
        
        pros = random.sample(potential_pros, min(num_pros, len(potential_pros)))
        cons = random.sample(potential_cons, min(num_cons, len(potential_cons)))
        
        return pros, cons
    
    def highlight_key_points(self, reviews: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Extract the most important points from each review.
        
        Args:
            reviews (List[Dict[str, Any]]): List of review dictionaries.
            
        Returns:
            List[Dict[str, Any]]: List of reviews with highlighted key points.
        """
        if not reviews:
            return []
        
        self.logger.info(f"Highlighting key points in {len(reviews)} reviews")
        
        highlighted_reviews = []
        
        for review in reviews:
            # In a real implementation, this would call the AI model
            # to identify the most important parts of each review
            
            # For now, we'll just highlight the review title and first sentence
            highlighted = review.copy()
            
            # Extract first sentence if review text is available
            if review.get('text'):
                sentences = re.split(r'(?<=[.!?])\s+', review['text'])
                if sentences:
                    highlighted['key_point'] = sentences[0]
                else:
                    highlighted['key_point'] = review['text'][:100] + "..." if len(review['text']) > 100 else review['text']
            else:
                highlighted['key_point'] = review.get('title', "No key points available")
            
            highlighted_reviews.append(highlighted)
        
        return highlighted_reviews


def summarize_reviews(reviews: List[Dict[str, Any]], api_key: str = None) -> Dict[str, Any]:
    """
    Utility function to generate a summary from a list of reviews.
    
    Args:
        reviews (List[Dict[str, Any]]): List of review dictionaries.
        api_key (str, optional): API key for the AI service.
        
    Returns:
        Dict[str, Any]: Generated summary data.
    """
    summarizer = ReviewSummarizer(api_key)
    return summarizer.generate_summary(reviews)


# Example usage
if __name__ == "__main__":
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Create some sample reviews
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
    
    # Generate a summary
    summary = summarize_reviews(sample_reviews)
    
    # Print the results
    print(f"\n{'-'*50}")
    print(f"AI-GENERATED REVIEW SUMMARY")
    print(f"{'-'*50}")
    print(f"\n{summary['summary']}")
    
    print(f"\n{'-'*50}")
    print(f"KEY POINTS")
    print(f"{'-'*50}")
    for point in summary['key_points']:
        print(f"• {point}")
    
    print(f"\n{'-'*50}")
    print(f"PROS & CONS")
    print(f"{'-'*50}")
    print("Pros:")
    for pro in summary['pros']:
        print(f"✓ {pro}")
    
    print("\nCons:")
    for con in summary['cons']:
        print(f"✗ {con}")
    
    print(f"\n{'-'*50}")
    print(f"Overall Sentiment: {summary['sentiment'].capitalize()}")
    print(f"{'-'*50}")
    
    # Highlight key points in reviews
    summarizer = ReviewSummarizer()
    highlighted_reviews = summarizer.highlight_key_points(sample_reviews)
    
    print(f"\n{'-'*50}")
    print(f"HIGHLIGHTED REVIEWS")
    print(f"{'-'*50}")
    for i, review in enumerate(highlighted_reviews):
        print(f"Review #{i+1}: {review['title']} - {review['rating']} stars")
        print(f"Key point: {review['key_point']}")
        print() 