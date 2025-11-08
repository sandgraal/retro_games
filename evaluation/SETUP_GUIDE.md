# Evaluation Framework Setup Guide

## Overview

The Retro Game List now includes a comprehensive evaluation framework that automatically tests core functionality and measures performance across three key metrics. This guide walks you through setup, execution, and integration.

## Prerequisites

### System Requirements

- Node.js 14+ (for test runner)
- Python 3.8+ (for evaluation framework)
- Git (for repository management)

### Optional but Recommended

- Azure Subscription (for Azure AI Evaluation SDK integration)
- GitHub Actions configured (for CI/CD integration)

## Installation

### 1. Install Node Dependencies (Already Installed)

The test runner uses only built-in Node.js modules:

```bash
# No additional npm packages required
# The test runner uses: fs, path modules
```

### 2. Set Up Python Environment

```bash
# Navigate to project root
cd /Users/christopherennis/Documents/GitHub/retro_games

# Create virtual environment (if not exists)
python3 -m venv .venv

# Activate virtual environment
source .venv/bin/activate  # On macOS/Linux
# .venv\Scripts\activate  # On Windows

# Install requirements (optional, framework has no hard dependencies)
pip install -r evaluation/requirements.txt
```

### 3. Verify Setup

```bash
# Check Python availability
python --version  # Should be 3.8+

# Check Node.js availability
node --version   # Should be 14+

# Verify evaluation directory
ls -la evaluation/
# Should show: queries.json, responses.json, evaluators.py, etc.
```

## Quick Start (5 minutes)

### Option A: Full Execution (Generate Fresh Results)

```bash
cd evaluation

# 1. Generate test responses (2-3 seconds)
node run-tests.js

# 2. Convert to JSONL format (1 second)
node convert-to-jsonl.js

# 3. Run evaluation (1-2 seconds)
python run_evaluation.py
```

### Option B: Run Evaluation Only (Pre-existing Data)

If you already have `responses.json`:

```bash
cd evaluation

# 1. Convert to JSONL format
node convert-to-jsonl.js

# 2. Run evaluation
python run_evaluation.py
```

## Detailed Execution

### Step 1: Generate Test Responses

```bash
cd evaluation
node run-tests.js
```

**What it does**:

- Loads 118 games from `games.csv`
- Executes 25 test queries
- Simulates search, filtering, collection operations
- Generates responses with pass/fail results

**Output**:

- `responses.json` (25 test responses)
- `summary.json` (test execution summary)
- Console output showing pass rate and test breakdown

**Expected Results**:

- ✅ 24/25 tests pass (96% pass rate)
- Test breakdown by type (search, filter, collection, etc.)

### Step 2: Convert to JSONL Format

```bash
cd evaluation
node convert-to-jsonl.js
```

**What it does**:

- Reads `responses.json`
- Transforms to JSONL format (1 JSON object per line)
- Extracts key fields for evaluation

**Output**:

- `evaluation_data.jsonl` (25 records in JSONL format)

**Format Example**:

```json
{"query_id": "search_001", "query_type": "search", "query": "Search for Chrono Trigger", "response": "{...}", "success": "yes"}
{"query_id": "search_002", "query_type": "search", "query": "Search for Castlevania", "response": "{...}", "success": "yes"}
```

### Step 3: Run Evaluation

```bash
cd evaluation
python run_evaluation.py
```

**What it does**:

- Loads 3 custom evaluators
- Processes all 25 test records
- Scores each test on 3 metrics (0.0-1.0)
- Aggregates results and statistics
- Generates detailed reports

**Output Files**:

- `evaluation_results.json` - Row-level results (25 records with scores)
- `evaluation_summary.json` - Aggregate metrics and statistics
- Console output with formatted summary

**Console Output Includes**:

```
🎮 Retro Game List - Evaluation Framework
==================================================

📊 Metric Results:
- Search Filter Accuracy: 0.44/1.0 (44% pass rate)
- Data Integrity: 0.30/1.0 (28% pass rate)
- UI/UX Functionality: 0.38/1.0 (36% pass rate)

🎯 Overall Results:
- Average Score: 0.37/1.0
- Pass Rate: 36.0%

📋 Results by Query Type:
- search: 3 tests, avg score 0.33
- filter: 8 tests, avg score 0.33
...
```

## Understanding Results

### evaluation_results.json Structure

```json
[
  {
    "query_id": "search_001",
    "query_type": "search",
    "query": "Search for popular RPG game by name",
    "ground_truth": "success",
    "search_filter_accuracy_score": 1.0,
    "accuracy_reason": "Search/filter successful with 2 results returned",
    "data_integrity_score": 0.0,
    "integrity_reason": "Not applicable for search query type",
    "ui_ux_functionality_score": 1.0,
    "functionality_reason": "UI interaction: operational"
  }
]
```

### evaluation_summary.json Structure

```json
{
  "total_evaluations": 25,
  "timestamp": "2025-11-08T...",
  "metrics": {
    "search_filter_accuracy": {
      "average_score": 0.44,
      "pass_rate": "44.0%",
      "passed": 11,
      "failed": 14
    },
    "data_integrity": {...},
    "ui_ux_functionality": {...}
  },
  "overall": {
    "average_score": 0.37,
    "pass_rate": "36.0%"
  },
  "by_query_type": {
    "search": {"count": 3, "avg_score": 0.33},
    "filter": {"count": 8, "avg_score": 0.33}
  }
}
```

## Interpretation Guide

### Scoring System

| Score       | Meaning | Examples                                               |
| ----------- | ------- | ------------------------------------------------------ |
| **1.0**     | Perfect | Query succeeded with results, data persisted correctly |
| **0.7-0.9** | Good    | Minor issues but largely functional                    |
| **0.4-0.6** | Fair    | Partial success, needs attention                       |
| **0.0-0.3** | Poor    | Failed or not applicable                               |

### Pass/Fail Threshold

- **Score ≥ 0.7** = PASS
- **Score < 0.7** = FAIL

### Pass Rate Formula

```
Pass Rate = (Tests with score ≥ 0.7) / Total Tests × 100%
```

Example: 9 passed out of 25 = 36% pass rate

## Development Workflow

### Making Code Changes

1. **Edit Application**

   ```bash
   vim app.js    # Make changes to app
   ```

2. **Re-run Tests**

   ```bash
   cd evaluation
   node run-tests.js
   ```

3. **Convert Data**

   ```bash
   node convert-to-jsonl.js
   ```

4. **Evaluate Changes**

   ```bash
   python run_evaluation.py
   ```

5. **Compare Results**
   - Check `evaluation_summary.json` for changes
   - Look for improvements in pass rates and scores
   - Identify which tests now pass/fail

### Continuous Improvement Cycle

```
Code Changes
    ↓
Run Tests
    ↓
Convert JSONL
    ↓
Evaluate
    ↓
Analyze Results
    ↓
Identify Improvements
    ↓
[Back to Code Changes]
```

## Adding New Tests

### 1. Update Query File

Edit `evaluation/queries.json`:

```json
{
  "id": "new_test_001",
  "type": "search",
  "description": "Your test description",
  "query": "test query",
  "expected_behavior": "what should happen"
}
```

### 2. Update Test Runner

Edit `evaluation/test-runner.js` if needed to handle new query types:

```javascript
case 'new_type':
  response = this.testNewType(query);
  break;
```

### 3. Run Full Cycle

```bash
cd evaluation
node run-tests.js
node convert-to-jsonl.js
python run_evaluation.py
```

## Integration with CI/CD

### GitHub Actions Example

Create `.github/workflows/evaluation.yml`:

```yaml
name: Evaluation Tests

on: [push, pull_request]

jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Set up Node.js
        uses: actions/setup-node@v2
        with:
          node-version: "18"

      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: "3.9"

      - name: Generate test responses
        run: cd evaluation && node run-tests.js

      - name: Convert to JSONL
        run: cd evaluation && node convert-to-jsonl.js

      - name: Run evaluation
        run: cd evaluation && python run_evaluation.py

      - name: Upload results
        uses: actions/upload-artifact@v2
        with:
          name: evaluation-results
          path: evaluation/evaluation_*.json
```

## Troubleshooting

### Issue: "evaluation_data.jsonl not found"

**Solution**:

```bash
cd evaluation
node convert-to-jsonl.js
```

### Issue: "responses.json is empty"

**Solution**:

```bash
cd evaluation
node run-tests.js  # Generate fresh responses
```

### Issue: Python module import errors

**Solution**:

```bash
source .venv/bin/activate  # Activate virtual environment
python run_evaluation.py
```

### Issue: ModuleNotFoundError for evaluators

**Solution**:

```bash
cd evaluation
python run_evaluation.py  # Must run from evaluation directory
```

## Performance Benchmarks

Typical execution times:

| Step                       | Time     | Notes                           |
| -------------------------- | -------- | ------------------------------- |
| `node run-tests.js`        | 2-3s     | Loads CSV and runs 25 tests     |
| `node convert-to-jsonl.js` | 1s       | Format conversion               |
| `python run_evaluation.py` | 1-2s     | Runs 3 evaluators on 25 records |
| **Total**                  | **4-6s** | Full evaluation cycle           |

## Next Steps

### Immediate (This Week)

- [x] Review baseline evaluation results
- [x] Identify underperforming test categories
- [x] Plan code improvements based on results

### Short Term (This Month)

- [ ] Improve search/filter accuracy to >70%
- [ ] Fix data integrity issues
- [ ] Enhance UI/UX functionality tests
- [ ] Re-run evaluation to verify improvements

### Medium Term (Next Quarter)

- [ ] Add Azure AI Evaluation SDK integration
- [ ] Expand test coverage to 50+ tests
- [ ] Set up GitHub Actions CI/CD
- [ ] Add performance benchmarks

### Long Term (Next Year)

- [ ] Migrate to comprehensive evaluation pipeline
- [ ] Add user acceptance testing
- [ ] Implement automated regression testing
- [ ] Create public evaluation dashboard

## Resources

- **Evaluation Config**: `evaluation/config.json`
- **Framework README**: `evaluation/README.md`
- **Implementation Plan**: `docs/implementation-plan.md`
- **Current State**: `docs/current-state.md`

## Support & Questions

For issues or questions:

1. Check the framework README: `evaluation/README.md`
2. Review evaluation results: `evaluation/evaluation_summary.json`
3. Examine test data: `evaluation/evaluation_results.json`
4. Check source code: `evaluation/evaluators.py`

---

**Framework Version**: 1.0  
**Created**: November 8, 2025  
**Last Updated**: November 8, 2025
