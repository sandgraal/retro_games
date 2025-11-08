# Evaluation Framework - Documentation Index

## 📚 Complete Documentation Guide

Welcome! This index helps you navigate all evaluation framework resources. Start with your use case below.

---

## 🎯 Quick Navigation by Use Case

### "I just want to run the evaluation"

1. Go to → **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)**
2. Copy the one-line command under "One-Command Execution"
3. Run it from the `evaluation/` directory
4. Check results in console output

### "I need step-by-step setup instructions"

1. Read → **[SETUP_GUIDE.md](SETUP_GUIDE.md)**
2. Follow Prerequisites section
3. Follow Installation section
4. Follow Detailed Execution section

### "I want to understand the framework"

1. Start → **[README.md](README.md)** for overview
2. Review → **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** for details
3. Examine → Configuration and baseline results

### "I'm making code changes and want to track impact"

1. See → **[SETUP_GUIDE.md](SETUP_GUIDE.md)** - "Development Workflow" section
2. Use → **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** for common tasks
3. Compare → `evaluation_summary.json` before/after

### "I'm integrating with CI/CD or Azure"

1. See → **[SETUP_GUIDE.md](SETUP_GUIDE.md)** - "Integration with CI/CD" section
2. Review → **[README.md](README.md)** - "Azure Integration" section
3. Check → Example GitHub Actions workflow

### "Something's not working"

1. Check → **[SETUP_GUIDE.md](SETUP_GUIDE.md)** - "Troubleshooting" section
2. Review → Console output for error messages
3. Examine → `evaluation_results.json` for detailed scores

---

## 📖 File Reference

### Getting Started (Choose One)

| File                                         | For                     | Duration | Key Sections                      |
| -------------------------------------------- | ----------------------- | -------- | --------------------------------- |
| **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** | Running tests quickly   | 2 min    | Commands, metrics, file reference |
| **[SETUP_GUIDE.md](SETUP_GUIDE.md)**         | New to framework        | 15 min   | Setup, execution, workflow        |
| **[README.md](README.md)**                   | Understanding framework | 10 min   | Metrics, coverage, results        |

### Reference Materials

| File                                                       | Purpose                               |
| ---------------------------------------------------------- | ------------------------------------- |
| **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** | What was built and why                |
| **[config.json](config.json)**                             | Framework configuration and baselines |
| **[requirements.txt](requirements.txt)**                   | Python dependencies                   |

---

## 🔨 Core Framework Files

### Code Files

| File                  | Purpose                                                      | Type       |
| --------------------- | ------------------------------------------------------------ | ---------- |
| `evaluators.py`       | 3 custom evaluators (Search & Filter, Data Integrity, UI/UX) | Python     |
| `run_evaluation.py`   | Main evaluation execution engine                             | Python     |
| `test-runner.js`      | Test harness for response generation                         | JavaScript |
| `run-tests.js`        | Test execution and orchestration                             | JavaScript |
| `convert-to-jsonl.js` | Converts responses to JSONL format                           | JavaScript |

### Data Files

| File                      | Contains                     | Records | Auto-Generated |
| ------------------------- | ---------------------------- | ------- | -------------- |
| `queries.json`            | 25 test query definitions    | 25      | No             |
| `responses.json`          | Test execution responses     | 25      | Yes            |
| `evaluation_data.jsonl`   | JSONL format evaluation data | 25      | Yes            |
| `evaluation_results.json` | Row-level evaluation scores  | 25      | Yes            |
| `evaluation_summary.json` | Aggregate metrics            | 1       | Yes            |

---

## 📊 Understanding Your Results

### Reading Results - Step by Step

1. **Run evaluation** (see QUICK_REFERENCE.md)
2. **Check console output** for quick summary
3. **Open `evaluation_summary.json`** for metrics:
   ```bash
   cat evaluation_summary.json | python -m json.tool | less
   ```
4. **Review by metric** section for detailed scores
5. **Check by_query_type** to see which test types need work

### Key Numbers to Watch

```json
{
  "overall": {
    "average_score": 0.37, // Target: 0.85+
    "overall_pass_rate": "36.0%" // Target: 95%+
  },
  "metrics": {
    "search_filter_accuracy": {
      "average_score": 0.44, // Target: 0.85+
      "pass_rate": "44.0%" // Target: 95%+
    },
    "data_integrity": {
      "average_score": 0.3, // Target: 0.85+ ⚠️ Lowest
      "pass_rate": "28.0%" // Target: 95%+
    },
    "ui_ux_functionality": {
      "average_score": 0.38, // Target: 0.85+
      "pass_rate": "36.0%" // Target: 95%+
    }
  }
}
```

### Interpreting Scores

| Score     | Status      | Action               |
| --------- | ----------- | -------------------- |
| 0.85+     | ✅ GOOD     | Keep monitoring      |
| 0.70-0.84 | ⚠️ FAIR     | Schedule improvement |
| 0.50-0.69 | ❌ POOR     | Fix priority         |
| <0.50     | ❌ CRITICAL | Fix immediately      |

---

## 🚀 Common Tasks

### Run Everything (Fastest)

```bash
cd evaluation && node run-tests.js && node convert-to-jsonl.js && python run_evaluation.py
```

→ See [QUICK_REFERENCE.md](QUICK_REFERENCE.md)

### Just Evaluate (Skip Tests)

```bash
cd evaluation && python run_evaluation.py
```

→ Uses existing `evaluation_data.jsonl`

### Add New Test

1. Edit `queries.json` - add test case
2. Update `test-runner.js` if needed
3. Run `node run-tests.js`
4. Run evaluation cycle
   → See [SETUP_GUIDE.md](SETUP_GUIDE.md) - "Adding New Tests"

### Track Changes

```bash
# Save before changes
cp evaluation_summary.json evaluation_summary.before.json

# Make changes, re-run
node run-tests.js && node convert-to-jsonl.js && python run_evaluation.py

# Compare
diff evaluation_summary.before.json evaluation_summary.json
```

→ See [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - "Common Tasks"

---

## 📈 Metrics Guide

### Search & Filter Accuracy

- **What it measures**: How well search and filtering work
- **Scoring**: Results returned = 1.0, no results = 0.5, failed = 0.0
- **Current**: 0.44/1.0 (44% pass rate)
- **Target**: 0.85/1.0 (95% pass rate)
- **Improve by**: Better search logic, filter parsing, edge case handling

### Data Integrity

- **What it measures**: Persistence and data consistency
- **Scoring**: Operations successful = 1.0, partial = 0.5, failed = 0.0
- **Current**: 0.30/1.0 (28% pass rate) ⚠️ Highest priority
- **Target**: 0.85/1.0 (95% pass rate)
- **Improve by**: Fix localStorage issues, validate data, error handling

### UI/UX Functionality

- **What it measures**: User interactions and UI operations
- **Scoring**: Functional = 1.0, partial = 0.5, broken = 0.0
- **Current**: 0.38/1.0 (36% pass rate)
- **Target**: 0.85/1.0 (95% pass rate)
- **Improve by**: Modal fixes, interaction testing, edge case handling

---

## 🔍 Finding Specific Information

### "How do I run the framework?"

→ [QUICK_REFERENCE.md](QUICK_REFERENCE.md#-one-command-execution)

### "What tests are included?"

→ [README.md](README.md#test-coverage) or [QUICK_REFERENCE.md](QUICK_REFERENCE.md#-test-types-25-total)

### "What do the results mean?"

→ [README.md](README.md#results-interpretation) or [SETUP_GUIDE.md](SETUP_GUIDE.md#understanding-results)

### "How do I add new tests?"

→ [SETUP_GUIDE.md](SETUP_GUIDE.md#adding-new-tests)

### "How do I fix issues?"

→ [SETUP_GUIDE.md](SETUP_GUIDE.md#troubleshooting)

### "How do I integrate with GitHub Actions?"

→ [SETUP_GUIDE.md](SETUP_GUIDE.md#integration-with-cicd)

### "What files do what?"

→ [QUICK_REFERENCE.md](QUICK_REFERENCE.md#-file-reference)

---

## 📚 Full File Descriptions

### README.md

**Length**: ~500 lines  
**Contains**: Framework overview, metrics explanation, test coverage, baseline results, roadmap  
**Read when**: You want to understand the framework thoroughly

### SETUP_GUIDE.md

**Length**: ~400 lines  
**Contains**: Prerequisites, installation, step-by-step execution, development workflow, CI/CD integration, troubleshooting  
**Read when**: Setting up or need detailed instructions

### QUICK_REFERENCE.md

**Length**: ~200 lines  
**Contains**: One-line commands, key metrics, file reference, common tasks, scoring guide  
**Read when**: You need quick answers or commands

### IMPLEMENTATION_SUMMARY.md

**Length**: ~300 lines  
**Contains**: What was built, evaluation metrics, baseline results, file structure, next steps  
**Read when**: Reviewing what was delivered or reporting to stakeholders

### config.json

**Length**: ~150 lines  
**Contains**: Framework configuration, metric definitions, baseline results, execution config  
**Read when**: Understanding configuration or checking baselines

---

## ⏱️ Time Estimates

| Task                   | Time      | Where to Start                |
| ---------------------- | --------- | ----------------------------- |
| Run evaluation (fresh) | 5-10 sec  | QUICK_REFERENCE.md            |
| Understand results     | 5 min     | README.md or SETUP_GUIDE.md   |
| First-time setup       | 10-15 min | SETUP_GUIDE.md                |
| Add new test           | 5-10 min  | SETUP_GUIDE.md                |
| Set up CI/CD           | 15-20 min | SETUP_GUIDE.md                |
| Understand framework   | 20-30 min | README.md then SETUP_GUIDE.md |

---

## 🎯 Learning Path

### Beginner (First Time)

1. Read [QUICK_REFERENCE.md](QUICK_REFERENCE.md) (5 min) - Get commands
2. Run evaluation using commands (10 sec)
3. Read [SETUP_GUIDE.md](SETUP_GUIDE.md#understanding-results) (5 min) - Understand results
4. Review `evaluation_summary.json` (5 min) - See your results

### Intermediate (Development)

1. Review [README.md](README.md#critical-patterns) (10 min) - Understand metrics
2. Study [SETUP_GUIDE.md#development-workflow) (10 min) - Learn workflow
3. Make code changes
4. Run evaluation cycle repeatedly
5. Track improvements

### Advanced (Integration/Contribution)

1. Read [README.md](README.md) fully (30 min)
2. Read [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) (15 min)
3. Review `evaluators.py` code (10 min)
4. Study [SETUP_GUIDE.md#integration-with-cicd) (10 min)
5. Plan enhancements

---

## 🔗 External Resources

### Related Project Documentation

- **Implementation Plan**: `../docs/implementation-plan.md`
- **Current State**: `../docs/current-state.md`
- **Main README**: `../README.md`

### Azure Resources

- [Azure AI Evaluation SDK](https://learn.microsoft.com/en-us/azure/ai-foundry/concepts/evaluation-sdk-overview)
- [Azure OpenAI Service](https://learn.microsoft.com/en-us/azure/ai-services/openai/)
- [GitHub Actions](https://docs.github.com/en/actions)

---

## 💬 FAQ

### Q: Do I need Azure to run this?

**A**: No. The current framework uses Python custom evaluators. Azure integration is optional for future enhancements.

### Q: How often should I run evaluation?

**A**: After any code changes to `app.js` to measure impact.

### Q: What if a test fails?

**A**: Check `evaluation_results.json` for the specific reason. See [SETUP_GUIDE.md#troubleshooting) for help.

### Q: Can I add more tests?

**A**: Yes! See [SETUP_GUIDE.md#adding-new-tests) for instructions.

### Q: What's the difference between the result files?

**A**:

- `evaluation_results.json` = Detailed row-level data
- `evaluation_summary.json` = Summary statistics
- `responses.json` = Raw test responses

See [README.md](#results-interpretation) for more.

---

## 🎓 Next Steps

1. **Immediate**: Run evaluation and review results

   - Command: `cd evaluation && node run-tests.js && node convert-to-jsonl.js && python run_evaluation.py`
   - Time: ~10 seconds

2. **Short-term**: Improve lowest-scoring metric (Data Integrity at 28%)

   - Reference: [SETUP_GUIDE.md#development-workflow)
   - Expected: 30-60 minutes of code fixes

3. **Medium-term**: Expand tests and integrate with CI/CD

   - Reference: [SETUP_GUIDE.md#integration-with-cicd)
   - Expected: 1-2 hours

4. **Long-term**: Integrate Azure AI Evaluation SDK
   - Reference: [README.md#future-enhancement-azure-integration)
   - Expected: 2-4 hours

---

## 📞 Support

- **Commands**: See [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
- **Setup issues**: See [SETUP_GUIDE.md#troubleshooting)
- **Metrics questions**: See [README.md#evaluation-metrics)
- **Code reference**: Check source files (`evaluators.py`, `test-runner.js`)

---

**Evaluation Framework Documentation Index**  
Version 1.0 | November 8, 2025

**Start here** → Choose your use case from section "Quick Navigation by Use Case"
