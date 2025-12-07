# Evaluation Framework

## Overview

Automated testing and metrics collection for the Retro Game List application.

**Test Coverage:**
1. Search & filter accuracy
2. Data integrity (localStorage persistence)
3. UI/UX functionality (modals, sorting, exports)

**Note**: Tests may need updating for the new redesigned UI (December 2025). See [`../docs/architecture.md`](../docs/architecture.md) for current architecture.

## Quick Start

### 1. Run Tests

```bash
cd evaluation
node run-tests.js
```

This runs 25 automated tests covering:

- **Search tests** (3): Game name searches, case-insensitivity, franchise searches
- **Platform filters** (3): SNES, PS1, NES filtering
- **Genre filters** (3): RPG, Platformer, Action RPG with comma-separated handling
- **Combined filters** (2): Platform + Genre combinations
- **Collection management** (4): Add, remove, persistence, multiple games
- **Export/Import** (3): CSV export, share code generation and import
- **UI Interactions** (3): Modal operations, sorting
- **Edge cases** (3): Special characters, empty queries, missing data

**Output**: `responses.json` (25 test responses)

### 2. Convert to JSONL Format

```bash
node convert-to-jsonl.js
```

Converts responses into JSONL format required by the evaluation SDK.

**Output**: `evaluation_data.jsonl` (25 JSON records)

### 3. Run Evaluation

```bash
python run_evaluation.py
```

Executes all evaluators against the test data and generates reports.

**Outputs**:

- `evaluation_results.json` - Detailed results for each test
- `evaluation_summary.json` - Aggregate metrics and statistics
- Console summary with key metrics

## Evaluation Metrics

### Search & Filter Accuracy Evaluator

**Purpose**: Measures how accurately search and filter operations work

**Scoring**:

- `1.0` - Query successful with results returned
- `0.5` - Query successful but no results found
- `0.0` - Query failed to execute

**Key Checks**:

- Query execution success
- Results count > 0
- Results data populated

### Data Integrity Evaluator

**Purpose**: Validates data persistence and collection management

**Scoring**:

- `1.0` - Operation successful, data properly handled
- `0.5` - Operation partial or partially successful
- `0.0` - Operation failed

**Key Checks**:

- Collection add/remove operations succeed
- Persistence is supported and verified
- CSV export produces valid format
- Share code generation creates valid codes
- Share code import correctly decodes data

### UI/UX Functionality Evaluator

**Purpose**: Ensures user-facing interactions work correctly

**Scoring**:

- `1.0` - Interaction works as expected
- `0.5` - Interaction needs verification
- `0.0` - Interaction not functional

**Key Checks**:

- Modal operations (open/close)
- Sorting functionality
- Export operations
- Share code UI functions
- Edge case handling

## Results Interpretation

### Summary Metrics

| Metric            | Definition                            | Target            |
| ----------------- | ------------------------------------- | ----------------- |
| **Average Score** | Mean score across all tests (0.0-1.0) | ≥ 0.85            |
| **Pass Rate**     | Percentage of tests with score ≥ 0.7  | ≥ 95%             |
| **Min/Max Score** | Range of individual test scores       | Identify outliers |

### Results by Query Type

Breakdown of performance by test category:

- `search` - General search functionality
- `filter` - Platform and genre filtering
- `collection` - Collection management operations
- `export` - CSV export functionality
- `sharecode` - Share code generation and import
- `ui_interaction` - User interface interactions
- `edge_case` - Edge case handling

## Integration with Azure AI Evaluation SDK

This framework is designed to be compatible with the Azure AI Evaluation SDK (`azure-ai-evaluation`). The evaluators can be migrated to use:

- Built-in evaluators for standard metrics
- Custom code-based evaluators for business logic
- Custom prompt-based evaluators for LLM-based assessment

### Future Enhancement: Azure Integration

To integrate with Azure AI Evaluation:

```python
from azure.ai.evaluation import evaluate
from evaluators import create_evaluators, get_evaluator_config

result = evaluate(
    data="evaluation_data.jsonl",
    evaluators=create_evaluators(),
    evaluator_config=get_evaluator_config(),
    output_path="./azure_results"
)
```

## Test Coverage

| Feature          | Tests  | Coverage                                   |
| ---------------- | ------ | ------------------------------------------ |
| Search           | 3      | Game name, franchises, case-insensitivity  |
| Platform Filter  | 3      | SNES, PS1, NES                             |
| Genre Filter     | 3      | RPG, Platformer, Action RPG                |
| Combined Filters | 2      | Platform + Genre combinations              |
| Collection Mgmt  | 4      | Add, remove, persist, batch operations     |
| Export           | 1      | CSV format validation                      |
| Share Codes      | 3      | Generation, import, encoding               |
| UI Interactions  | 3      | Modals, sorting, interactions              |
| Edge Cases       | 3      | Special chars, empty queries, missing data |
| **Total**        | **25** | **100% core functionality**                |

## Current Evaluation Results

```
Total Tests: 25
Pass Rate: 36.0% (9/25 passed with score ≥ 0.7)

Metric Scores:
- Search & Filter Accuracy: 0.44/1.0 (44% pass rate)
- Data Integrity: 0.30/1.0 (28% pass rate)
- UI/UX Functionality: 0.38/1.0 (36% pass rate)

Best Performing: Export/Sharecode (0.67 avg)
Needs Improvement: Collection mgmt (0.29 avg)
```

## Recommendations for Improvement

Based on current evaluation results:

1. **Collection Management**: Focus on verifying localStorage persistence and game key uniqueness
2. **Filter Accuracy**: Ensure all filter types correctly parse comma-separated genre fields
3. **Search Edge Cases**: Improve handling of special characters and empty queries
4. **Modal Interactions**: Verify modal state management and focus trapping

## Development Workflow

1. Make code changes to `app.js` or related files
2. Run `node run-tests.js` to regenerate test responses
3. Run `python run_evaluation.py` to evaluate changes
4. Compare results with previous evaluation summary
5. Iterate on improvements

## Adding New Tests

To add new evaluation tests:

1. Edit `evaluation/queries.json` to add new test cases
2. Update `test-runner.js` to handle new query types if needed
3. Run `node run-tests.js` to generate responses
4. Run `node convert-to-jsonl.js` to format data
5. Run `python run_evaluation.py` to evaluate

## Next Steps

### Phase 1: Framework Establishment ✅

- [x] Design evaluation metrics
- [x] Create test queries (25 tests)
- [x] Generate test responses
- [x] Implement custom evaluators
- [x] Generate baseline results

### Phase 2: Integration & Expansion

- [ ] Integrate with Azure AI Evaluation SDK
- [ ] Add prompt-based evaluators for subjective metrics
- [ ] Expand test coverage to 50+ tests
- [ ] Add performance benchmarks
- [ ] Generate evaluation reports

### Phase 3: CI/CD Integration

- [ ] Add evaluation to GitHub Actions
- [ ] Automated regression testing on PRs
- [ ] Performance tracking over time
- [ ] Public evaluation dashboard

## References

- [Azure AI Evaluation SDK Documentation](https://learn.microsoft.com/en-us/azure/ai-foundry/concepts/evaluation-sdk-overview)
- [Retro Game List Implementation Plan](../docs/implementation-plan.md)
- [Current State Documentation](../docs/current-state.md)

## Support

For questions or issues with the evaluation framework:

1. Check the evaluation results and summary files
2. Review test responses in `responses.json`
3. Examine individual evaluator logic in `evaluators.py`
4. Check GitHub Issues for related discussions

---

**Last Updated**: November 8, 2025
**Framework Version**: 1.0
**Evaluators**: 3 (Search & Filter Accuracy, Data Integrity, UI/UX Functionality)
**Test Cases**: 25
