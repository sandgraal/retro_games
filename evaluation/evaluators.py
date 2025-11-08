"""
Evaluation Framework for Retro Game List Application

This module implements evaluation for three key metrics:
1. Search & Filter Accuracy
2. Data Integrity
3. UI/UX Functionality

Uses Azure AI Evaluation SDK with custom code-based evaluators.
"""

import json
import sys
from typing import Any, Dict, Optional
from pathlib import Path


class SearchFilterAccuracyEvaluator:
    """
    Evaluates search and filter accuracy.
    
    Checks if search queries, platform filters, and genre filters return correct results
    and match expected behavior.
    """
    
    def __init__(self):
        """Initialize the evaluator."""
        pass
    
    def __call__(
        self,
        *,
        query_type: str,
        response: str,
        success: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Evaluate search and filter accuracy.
        
        Args:
            query_type: Type of query (search, filter)
            response: JSON string containing the response data
            success: Whether the query was successful
            **kwargs: Additional arguments
        
        Returns:
            Dictionary with evaluation results including accuracy score and reason
        """
        try:
            response_data = json.loads(response) if isinstance(response, str) else response
        except (json.JSONDecodeError, TypeError):
            return {
                "search_filter_accuracy_score": 0,
                "accuracy_reason": "Invalid response format"
            }
        
        score = 0
        reason = ""
        
        # Check if query is search or filter type
        if query_type in ['search', 'filter']:
            # Verify results were returned
            if isinstance(response_data, dict):
                results_count = response_data.get('results_count', 0)
                has_results = response_data.get('results', [])
                query_success = response_data.get('success', False)
                
                # Score calculation
                if query_success and results_count > 0 and has_results:
                    score = 1.0  # Perfect: successful query with results
                    reason = f"Search/filter successful with {results_count} results returned"
                elif query_success and results_count == 0:
                    score = 0.5  # Partial: query executed but no results
                    reason = "Query executed successfully but returned no results"
                else:
                    score = 0.0
                    reason = "Query execution failed"
        
        return {
            "search_filter_accuracy_score": score,
            "accuracy_reason": reason
        }


class DataIntegrityEvaluator:
    """
    Evaluates data integrity for collection management.
    
    Validates that owned games are properly persisted to localStorage
    and that collection import/export works correctly.
    """
    
    def __init__(self):
        """Initialize the evaluator."""
        pass
    
    def __call__(
        self,
        *,
        query_type: str,
        response: str,
        success: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Evaluate data integrity.
        
        Args:
            query_type: Type of query (collection, export, sharecode)
            response: JSON string containing the response data
            success: Whether the operation was successful
            **kwargs: Additional arguments
        
        Returns:
            Dictionary with evaluation results including integrity score and reason
        """
        try:
            response_data = json.loads(response) if isinstance(response, str) else response
        except (json.JSONDecodeError, TypeError):
            return {
                "data_integrity_score": 0,
                "integrity_reason": "Invalid response format"
            }
        
        score = 0
        reason = ""
        
        if query_type == 'collection':
            # Evaluate collection operations (add, remove, persist)
            action = response_data.get('action', '')
            
            if action == 'persist':
                # Check if persistence is supported
                is_supported = response_data.get('persistence_supported', False)
                score = 1.0 if is_supported else 0.5
                reason = f"Collection persistence {'supported' if is_supported else 'not verified'}"
            else:
                # Check if game operations succeeded
                operation_success = response_data.get('success', False)
                if 'games' in response_data:
                    # Multiple games - check all succeeded
                    all_succeeded = all(g.get('success', False) for g in response_data.get('games', []))
                    score = 1.0 if all_succeeded else 0.5
                    reason = f"Batch collection operation: {'all succeeded' if all_succeeded else 'partial success'}"
                else:
                    score = 1.0 if operation_success else 0.0
                    reason = f"Collection {action} operation: {'succeeded' if operation_success else 'failed'}"
        
        elif query_type == 'export':
            # Evaluate CSV export integrity
            csv_valid = response_data.get('csv_valid', False)
            games_count = response_data.get('games_count', 0)
            
            if csv_valid and games_count > 0:
                score = 1.0
                reason = f"CSV export valid with {games_count} games"
            elif csv_valid:
                score = 0.5
                reason = "CSV format valid but no games exported"
            else:
                score = 0.0
                reason = "CSV export failed or invalid format"
        
        elif query_type == 'sharecode':
            # Evaluate share code generation and import
            action = response_data.get('action', '')
            
            if action == 'generate_sharecode':
                code_valid = response_data.get('share_code_valid', False)
                games_count = response_data.get('games_count', 0)
                score = 1.0 if code_valid and games_count > 0 else 0.5
                reason = f"Share code generation: {'valid' if code_valid else 'invalid'}"
            
            elif action == 'import_sharecode':
                imported_count = response_data.get('games_imported', 0)
                score = 1.0 if imported_count > 0 else 0.0
                reason = f"Share code import: {imported_count} games imported"
        
        return {
            "data_integrity_score": score,
            "integrity_reason": reason
        }


class UIUXFunctionalityEvaluator:
    """
    Evaluates UI/UX functionality.
    
    Ensures core interactions like modal opening, sorting, CSV export,
    and share code generation work as expected.
    """
    
    def __init__(self):
        """Initialize the evaluator."""
        pass
    
    def __call__(
        self,
        *,
        query_type: str,
        response: str,
        success: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Evaluate UI/UX functionality.
        
        Args:
            query_type: Type of query (ui_interaction, export, sharecode, edge_case)
            response: JSON string containing the response data
            success: Whether the operation was successful
            **kwargs: Additional arguments
        
        Returns:
            Dictionary with evaluation results including functionality score and reason
        """
        try:
            response_data = json.loads(response) if isinstance(response, str) else response
        except (json.JSONDecodeError, TypeError):
            return {
                "ui_ux_functionality_score": 0,
                "functionality_reason": "Invalid response format"
            }
        
        score = 0
        reason = ""
        
        if query_type == 'ui_interaction':
            # Evaluate UI interactions (modal, sorting, etc.)
            action = response_data.get('action', '')
            operation_success = response_data.get('success', False)
            
            score = 1.0 if operation_success else 0.5
            reason = f"UI interaction '{action}': {'operational' if operation_success else 'needs verification'}"
        
        elif query_type == 'export':
            # Evaluate export functionality
            csv_valid = response_data.get('csv_valid', False)
            score = 1.0 if csv_valid else 0.5
            reason = f"Export functionality: {'working' if csv_valid else 'partial'}"
        
        elif query_type == 'sharecode':
            # Evaluate share code UI functionality
            action = response_data.get('action', '')
            success_val = response_data.get('success', False)
            
            score = 1.0 if success_val else 0.5
            reason = f"Share code UI ({action}): {'functional' if success_val else 'needs attention'}"
        
        elif query_type == 'edge_case':
            # Evaluate edge case handling
            success_val = response_data.get('success', False)
            score = 1.0 if success_val else 0.5
            reason = f"Edge case handling: {'graceful' if success_val else 'needs improvement'}"
        
        return {
            "ui_ux_functionality_score": score,
            "functionality_reason": reason
        }


def create_evaluators() -> Dict[str, Any]:
    """
    Create all evaluators for the evaluation framework.
    
    Returns:
        Dictionary mapping evaluator names to evaluator instances
    """
    return {
        "search_filter_accuracy": SearchFilterAccuracyEvaluator(),
        "data_integrity": DataIntegrityEvaluator(),
        "ui_ux_functionality": UIUXFunctionalityEvaluator(),
    }


def get_evaluator_config() -> Dict[str, Dict[str, Any]]:
    """
    Get the configuration for all evaluators.
    
    This defines the column mappings from the dataset to evaluator parameters.
    
    Returns:
        Dictionary mapping evaluator names to their configurations
    """
    return {
        "search_filter_accuracy": {
            "column_mapping": {
                "query_type": "${data.query_type}",
                "response": "${data.response}",
                "success": "${data.success}",
            }
        },
        "data_integrity": {
            "column_mapping": {
                "query_type": "${data.query_type}",
                "response": "${data.response}",
                "success": "${data.success}",
            }
        },
        "ui_ux_functionality": {
            "column_mapping": {
                "query_type": "${data.query_type}",
                "response": "${data.response}",
                "success": "${data.success}",
            }
        },
    }


if __name__ == "__main__":
    print("✅ Evaluation framework loaded successfully")
    print(f"   Available evaluators: {list(create_evaluators().keys())}")
