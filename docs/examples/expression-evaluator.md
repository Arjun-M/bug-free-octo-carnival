# Example: Expression Evaluator

Build a safe calculator/expression evaluator using IsoBox.

## Use Case

Create a service that evaluates mathematical expressions submitted by users, like a calculator API or spreadsheet formula engine.

## Requirements

- Evaluate mathematical expressions safely
- Support variables and functions
- Handle errors gracefully
- Prevent malicious code execution
- High performance (many evaluations/second)

## Implementation

### Basic Expression Evaluator

```typescript
import { IsoBox } from 'isobox';

class ExpressionEvaluator {
  private box: IsoBox;

  constructor() {
    this.box = new IsoBox({
      timeout: 1000,  // 1 second
      memoryLimit: 32 * 1024 * 1024,  // 32MB
      strictTimeout: true,

      // No modules needed for math
      require: {
        mode: 'whitelist',
        whitelist: []
      }
    });
  }

  async evaluate(expression: string, variables: Record<string, number> = {}): Promise<number> {
    // Validate expression
    if (!this.isValidExpression(expression)) {
      throw new Error('Invalid expression');
    }

    // Execute
    try {
      const result = await this.box.run(expression, {
        sandbox: variables
      });

      // Ensure result is a number
      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('Result must be a finite number');
      }

      return result;
    } catch (error) {
      throw new Error(`Evaluation failed: ${error.message}`);
    }
  }

  private isValidExpression(expr: string): boolean {
    // Only allow math operations, numbers, and variables
    const validPattern = /^[0-9a-zA-Z_\s+\-*\/().,<>=&|!%]+$/;
    return validPattern.test(expr) && expr.length < 1000;
  }

  async dispose() {
    await this.box.dispose();
  }
}
```

### Usage

```typescript
const evaluator = new ExpressionEvaluator();

// Simple math
const result1 = await evaluator.evaluate('2 + 2');
console.log(result1); // 4

// With variables
const result2 = await evaluator.evaluate('x * 2 + y', {
  x: 10,
  y: 5
});
console.log(result2); // 25

// Complex expression
const result3 = await evaluator.evaluate(
  'Math.sqrt(x * x + y * y)',
  { x: 3, y: 4 }
);
console.log(result3); // 5

await evaluator.dispose();
```

## Advanced Features

### Add Custom Functions

```typescript
class AdvancedEvaluator extends ExpressionEvaluator {
  constructor() {
    super();

    // Add custom math functions
    this.customFunctions = {
      // Average
      avg: (numbers: number[]) => {
        return numbers.reduce((a, b) => a + b, 0) / numbers.length;
      },

      // Percentage
      percent: (value: number, total: number) => {
        return (value / total) * 100;
      },

      // Round to decimal places
      round: (value: number, decimals: number = 0) => {
        const multiplier = Math.pow(10, decimals);
        return Math.round(value * multiplier) / multiplier;
      }
    };
  }

  async evaluate(expression: string, variables: Record<string, any> = {}): Promise<number> {
    // Inject custom functions
    const context = {
      ...variables,
      ...this.customFunctions
    };

    return super.evaluate(expression, context);
  }
}

// Usage
const evaluator = new AdvancedEvaluator();

await evaluator.evaluate('avg([10, 20, 30])');  // 20
await evaluator.evaluate('percent(25, 100)');    // 25
await evaluator.evaluate('round(3.14159, 2)');   // 3.14
```

### Spreadsheet Formula Engine

```typescript
interface Cell {
  formula?: string;
  value?: number;
  dependencies?: string[];
}

class SpreadsheetEngine {
  private box: IsoBox;
  private cells: Map<string, Cell> = new Map();

  constructor() {
    this.box = new IsoBox({
      timeout: 100,  // Fast evaluation
      memoryLimit: 16 * 1024 * 1024,
      usePooling: true,  // Performance boost
      pool: { min: 3, max: 10 }
    });
  }

  setCellFormula(cellId: string, formula: string) {
    this.cells.set(cellId, {
      formula,
      dependencies: this.extractDependencies(formula)
    });
  }

  async evaluateCell(cellId: string): Promise<number> {
    const cell = this.cells.get(cellId);
    if (!cell || !cell.formula) {
      return cell?.value || 0;
    }

    // Build context with dependency values
    const context: Record<string, number> = {};

    for (const depId of cell.dependencies || []) {
      context[depId] = await this.evaluateCell(depId);
    }

    // Evaluate formula
    const result = await this.box.run(cell.formula, {
      sandbox: context
    });

    // Cache result
    cell.value = result;
    return result;
  }

  private extractDependencies(formula: string): string[] {
    // Extract cell references (A1, B2, etc.)
    const pattern = /[A-Z]+[0-9]+/g;
    return formula.match(pattern) || [];
  }

  async dispose() {
    await this.box.dispose();
  }
}

// Usage
const sheet = new SpreadsheetEngine();

// Set formulas
sheet.setCellFormula('A1', '10');
sheet.setCellFormula('A2', '20');
sheet.setCellFormula('A3', 'A1 + A2');  // References A1 and A2
sheet.setCellFormula('A4', 'A3 * 2');    // References A3

// Evaluate
const result = await sheet.evaluateCell('A4');
console.log(result); // 60 (10 + 20) * 2

await sheet.dispose();
```

## API Endpoint

```typescript
import express from 'express';
import { body, validationResult } from 'express-validator';

const app = express();
const evaluator = new ExpressionEvaluator();

app.use(express.json());

app.post('/api/evaluate',
  // Validation
  body('expression').isString().trim().isLength({ min: 1, max: 1000 }),
  body('variables').optional().isObject(),

  async (req, res) => {
    // Check validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { expression, variables = {} } = req.body;

      const result = await evaluator.evaluate(expression, variables);

      res.json({
        expression,
        result,
        variables
      });
    } catch (error) {
      res.status(400).json({
        error: error.message
      });
    }
  }
);

// Cleanup on shutdown
process.on('SIGTERM', async () => {
  await evaluator.dispose();
  process.exit(0);
});

app.listen(3000, () => {
  console.log('Expression evaluator API running on port 3000');
});
```

### API Usage

```bash
# Simple expression
curl -X POST http://localhost:3000/api/evaluate \\
  -H "Content-Type: application/json" \\
  -d '{"expression": "2 + 2"}'

# With variables
curl -X POST http://localhost:3000/api/evaluate \\
  -H "Content-Type: application/json" \\
  -d '{
    "expression": "x * y + z",
    "variables": {"x": 10, "y": 5, "z": 2}
  }'

# Complex math
curl -X POST http://localhost:3000/api/evaluate \\
  -H "Content-Type: application/json" \\
  -d '{
    "expression": "Math.sqrt(Math.pow(a, 2) + Math.pow(b, 2))",
    "variables": {"a": 3, "b": 4}
  }'
```

## Performance Optimization

### Use Pooling

```typescript
const evaluator = new IsoBox({
  usePooling: true,
  pool: {
    min: 5,    // Always keep 5 ready
    max: 50,   // Scale up to 50
    idleTimeout: 60000,
    warmupCode: 'const Math = Math'  // Pre-initialize
  }
});

// Warm up pool on startup
await evaluator.warmupPool();
```

### Batch Evaluation

```typescript
async function evaluateBatch(
  expressions: Array<{ expr: string; vars?: Record<string, number> }>
): Promise<number[]> {
  const results = await Promise.all(
    expressions.map(({ expr, vars }) =>
      evaluator.evaluate(expr, vars)
    )
  );

  return results;
}

// Usage
const results = await evaluateBatch([
  { expr: '2 + 2' },
  { expr: 'x * 2', vars: { x: 10 } },
  { expr: 'y / 2', vars: { y: 100 } }
]);
console.log(results); // [4, 20, 50]
```

## Security Considerations

### Input Validation

```typescript
function validateExpression(expr: string): void {
  // Length check
  if (expr.length > 1000) {
    throw new Error('Expression too long');
  }

  // Character whitelist
  const allowedChars = /^[0-9a-zA-Z_\s+\-*\/().,<>=&|!%]+$/;
  if (!allowedChars.test(expr)) {
    throw new Error('Invalid characters in expression');
  }

  // Prevent dangerous patterns
  const forbidden = [
    /eval\s*\(/i,
    /Function\s*\(/i,
    /constructor/i,
    /__proto__/,
    /require\s*\(/i
  ];

  for (const pattern of forbidden) {
    if (pattern.test(expr)) {
      throw new Error('Forbidden pattern detected');
    }
  }
}
```

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 100,  // 100 requests per minute
  message: 'Too many evaluation requests'
});

app.post('/api/evaluate', limiter, evaluateHandler);
```

## Testing

```typescript
import { describe, it, expect } from 'vitest';

describe('ExpressionEvaluator', () => {
  let evaluator: ExpressionEvaluator;

  beforeEach(() => {
    evaluator = new ExpressionEvaluator();
  });

  afterEach(async () => {
    await evaluator.dispose();
  });

  it('evaluates simple math', async () => {
    expect(await evaluator.evaluate('2 + 2')).toBe(4);
    expect(await evaluator.evaluate('10 * 5')).toBe(50);
    expect(await evaluator.evaluate('100 / 4')).toBe(25);
  });

  it('evaluates with variables', async () => {
    const result = await evaluator.evaluate('x * 2', { x: 10 });
    expect(result).toBe(20);
  });

  it('handles complex expressions', async () => {
    const result = await evaluator.evaluate(
      'Math.sqrt(a * a + b * b)',
      { a: 3, b: 4 }
    );
    expect(result).toBe(5);
  });

  it('rejects invalid expressions', async () => {
    await expect(
      evaluator.evaluate('eval("malicious")')
    ).rejects.toThrow();
  });

  it('handles timeout', async () => {
    await expect(
      evaluator.evaluate('while(true) {}')
    ).rejects.toThrow();
  });
});
```

## Complete Example

See the full working example at:
- [GitHub Repository](https://github.com/yourusername/isobox-examples/tree/main/expression-evaluator)
- [Live Demo](https://isobox-expression-evaluator.demo.com)

## Next Steps

- Try the [Rules Engine Tutorial](./dynamic-rules-engine.md)
- Learn about [Template Engines](./template-engine.md)
- Explore [Data Transformation](./data-transformation.md)

---

**Need help?** Open an issue on [GitHub](https://github.com/yourusername/isobox/issues)
