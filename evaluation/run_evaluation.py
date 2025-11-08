"""
Evaluation Execution Script for Retro Game List Application

Runs all evaluation metrics against the test dataset and generates a comprehensive report.
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Any

# Add evaluation module to path
eval_dir = Path(__file__).parent
sys.path.insert(0, str(eval_dir))

from evaluators import create_evaluators, get_evaluator_config


def load_jsonl(file_path: str) -> List[Dict[str, Any]]:
    """Load JSONL file and return list of records."""
    records = []
    try:
        with open(file_path, 'r') as f:
            for line in f:
                if line.strip():
                    records.append(json.loads(line))
    except FileNotFoundError:
        print(f"❌ Error: File not found - {file_path}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"❌ Error: Invalid JSON in JSONL file - {e}")
        sys.exit(1)
    
    return records


def run_evaluations(data_path: str, output_dir: str = None) -> Dict[str, Any]:
    """
    Run all evaluations on the test dataset.
    
    Args:
        data_path: Path to evaluation_data.jsonl file
        output_dir: Directory for output files (defaults to same as data_path)
    
    Returns:
        Dictionary containing evaluation results and summary
    """
    if output_dir is None:
        output_dir = str(Path(data_path).parent)
    
    print("🎮 Retro Game List - Evaluation Framework")
    print("=" * 50)
    print()
    
    # Load data
    print(f"📋 Loading evaluation data from {data_path}...")
    records = load_jsonl(data_path)
    print(f"✅ Loaded {len(records)} test records\n")
    
    # Create evaluators
    print("🔧 Initializing evaluators...")
    evaluators = create_evaluators()
    evaluator_config = get_evaluator_config()
    print(f"✅ Initialized {len(evaluators)} evaluators:")
    for name in evaluators.keys():
        print(f"   - {name}")
    print()
    
    # Run evaluations
    print("⏱️  Running evaluations on all records...")
    all_results = []
    
    for idx, record in enumerate(records, 1):
        row_results = {
            "query_id": record.get("query_id"),
            "query_type": record.get("query_type"),
            "query": record.get("query"),
            "ground_truth": record.get("ground_truth"),
        }
        
        # Run each evaluator
        for evaluator_name, evaluator in evaluators.items():
            try:
                result = evaluator(
                    query_type=record.get("query_type"),
                    response=record.get("response"),
                    success=record.get("success"),
                )
                row_results.update(result)
            except Exception as e:
                print(f"⚠️  Error in {evaluator_name} for record {idx}: {str(e)}")
                row_results[f"{evaluator_name}_score"] = 0.0
                row_results[f"{evaluator_name}_reason"] = f"Evaluation error: {str(e)}"
        
        all_results.append(row_results)
    
    print(f"✅ Completed evaluations\n")
    
    # Calculate aggregate metrics
    print("📊 Calculating aggregate metrics...")
    summary = calculate_summary(all_results)
    
    # Save results
    results_file = Path(output_dir) / "evaluation_results.json"
    summary_file = Path(output_dir) / "evaluation_summary.json"
    
    print(f"💾 Saving detailed results to {results_file}...")
    with open(results_file, 'w') as f:
        json.dump(all_results, f, indent=2)
    
    print(f"💾 Saving summary to {summary_file}...")
    with open(summary_file, 'w') as f:
        json.dump(summary, f, indent=2)
    
    print()
    return summary


def calculate_summary(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Calculate summary statistics from evaluation results.
    
    Args:
        results: List of evaluation result dictionaries
    
    Returns:
        Dictionary containing summary statistics
    """
    summary = {
        "total_evaluations": len(results),
        "timestamp": __import__("datetime").datetime.now().isoformat(),
        "metrics": {}
    }
    
    # Aggregate scores for each metric
    metrics_to_aggregate = [
        "search_filter_accuracy_score",
        "data_integrity_score",
        "ui_ux_functionality_score"
    ]
    
    for metric in metrics_to_aggregate:
        scores = [r.get(metric, 0.0) for r in results if metric in r]
        
        if scores:
            avg_score = sum(scores) / len(scores)
            min_score = min(scores)
            max_score = max(scores)
            
            # Count pass/fail (score >= 0.7 is pass)
            passed = sum(1 for s in scores if s >= 0.7)
            failed = len(scores) - passed
            
            metric_name = metric.replace("_score", "")
            summary["metrics"][metric_name] = {
                "average_score": round(avg_score, 3),
                "min_score": round(min_score, 3),
                "max_score": round(max_score, 3),
                "total_tests": len(scores),
                "passed": passed,
                "failed": failed,
                "pass_rate": f"{(passed / len(scores) * 100):.1f}%"
            }
    
    # Overall statistics
    all_scores = []
    for metric in metrics_to_aggregate:
        scores = [r.get(metric, 0.0) for r in results if metric in r]
        all_scores.extend(scores)
    
    if all_scores:
        summary["overall"] = {
            "average_score": round(sum(all_scores) / len(all_scores), 3),
            "min_score": round(min(all_scores), 3),
            "max_score": round(max(all_scores), 3),
            "total_metric_evaluations": len(all_scores),
            "overall_pass_rate": f"{(sum(1 for s in all_scores if s >= 0.7) / len(all_scores) * 100):.1f}%"
        }
    
    # Results by query type
    summary["by_query_type"] = {}
    for result in results:
        query_type = result.get("query_type", "unknown")
        if query_type not in summary["by_query_type"]:
            summary["by_query_type"][query_type] = {
                "count": 0,
                "avg_score": 0.0
            }
        
        scores = [result.get(metric, 0.0) for metric in metrics_to_aggregate if metric in result]
        if scores:
            summary["by_query_type"][query_type]["count"] += 1
            summary["by_query_type"][query_type]["avg_score"] = \
                round((summary["by_query_type"][query_type]["avg_score"] * (summary["by_query_type"][query_type]["count"] - 1) + sum(scores) / len(scores)) / summary["by_query_type"][query_type]["count"], 3)
    
    return summary


def print_summary(summary: Dict[str, Any]) -> None:
    """Print formatted summary to console."""
    print("=" * 50)
    print("📊 EVALUATION SUMMARY")
    print("=" * 50)
    print()
    
    print(f"Total Evaluations: {summary['total_evaluations']}")
    print()
    
    print("📈 Metric Results:")
    print("-" * 50)
    for metric_name, metrics in summary.get("metrics", {}).items():
        print(f"\n{metric_name.replace('_', ' ').title()}:")
        print(f"  Average Score:  {metrics['average_score']:.2f}/1.0")
        print(f"  Score Range:    {metrics['min_score']:.2f} - {metrics['max_score']:.2f}")
        print(f"  Pass Rate:      {metrics['pass_rate']}")
        print(f"  Results:        {metrics['passed']} passed, {metrics['failed']} failed out of {metrics['total_tests']}")
    
    print()
    print("-" * 50)
    if "overall" in summary:
        overall = summary["overall"]
        print(f"\n🎯 Overall Results:")
        print(f"  Average Score:  {overall['average_score']:.2f}/1.0")
        print(f"  Score Range:    {overall['min_score']:.2f} - {overall['max_score']:.2f}")
        print(f"  Pass Rate:      {overall['overall_pass_rate']}")
    
    print()
    print("-" * 50)
    print("\n📋 Results by Query Type:")
    for query_type, stats in summary.get("by_query_type", {}).items():
        print(f"  {query_type}: {stats['count']} tests, avg score {stats['avg_score']:.2f}")
    
    print()
    print("✨ Evaluation complete!")


if __name__ == "__main__":
    # Get data path
    data_path = Path(__file__).parent / "evaluation_data.jsonl"
    
    if not data_path.exists():
        print(f"❌ Error: Evaluation data file not found at {data_path}")
        print("   Please run: node evaluation/convert-to-jsonl.js")
        sys.exit(1)
    
    # Run evaluations
    summary = run_evaluations(str(data_path))
    
    # Print summary
    print_summary(summary)
