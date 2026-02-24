## Understanding the Problem

Given two integers `num1` and `num2`, return their **sum**.

This is a foundational problem that introduces you to:
- **Function signatures**: How to define and return values from methods
- **Basic arithmetic**: Using the `+` operator
- **Integer handling**: Working with positive and negative numbers

---

## Key Concepts

**Integer Addition**: The `+` operator works with both positive and negative integers. For example:
- `12 + 5 = 17`
- `-10 + 4 = -6`
- `-3 + (-7) = -10`

**Overflow Consideration**: In Java, `int` can hold values from `-2³¹` to `2³¹ - 1`. Since the constraints guarantee `-100 ≤ num1, num2 ≤ 100`, overflow is not a concern here.

---

## Solution: Direct Addition

**Difficulty**: ⭐

### Approach

This problem has a straightforward solution: simply return `num1 + num2`. No special algorithm is needed.

While the solution is simple, it's a good exercise to understand:
1. How to read function parameters
2. How to return a value from a function
3. How different languages handle the same logic

### Implementation

```java
class Solution {
    public int sum(int num1, int num2) {
        return num1 + num2;
    }
}
```

```python
class Solution:
    def sum(self, num1: int, num2: int) -> int:
        return num1 + num2
```

### Complexity Analysis

- **Time Complexity:** O(1) — addition is a constant-time operation
- **Space Complexity:** O(1) — no extra memory is used

---

## Alternative Approaches

While the direct approach is optimal, here are some educational alternatives that demonstrate different techniques:

### Approach 2: Bit Manipulation (Without Using `+`)

A classic interview follow-up question: *"What if you can't use the `+` operator?"*

The idea is to simulate addition using bitwise operations:
- **XOR (`^`)**: Adds bits without considering carry (like addition ignoring carry)
- **AND (`&`) + left shift (`<<`)**: Computes the carry

Repeat until there's no carry left.

```java
class Solution {
    public int sum(int num1, int num2) {
        while (num2 != 0) {
            int carry = (num1 & num2) << 1;
            num1 = num1 ^ num2;
            num2 = carry;
        }
        return num1;
    }
}
```

```python
class Solution:
    def sum(self, num1: int, num2: int) -> int:
        # Python integers have arbitrary precision, so we need a mask
        MASK = 0xFFFFFFFF
        MAX_INT = 0x7FFFFFFF

        while num2 & MASK:
            carry = ((num1 & num2) << 1) & MASK
            num1 = (num1 ^ num2) & MASK
            num2 = carry

        # Handle negative numbers in Python
        return num1 if num1 <= MAX_INT else ~(num1 ^ MASK)
```

**How it works with `num1 = 12, num2 = 5`:**

```
Step 1:
  12 in binary:  1100
   5 in binary:  0101
  XOR (no carry): 1001 = 9
  AND + shift:    1000 = 8 (carry)

Step 2:
   9 in binary:  1001
   8 in binary:  1000
  XOR (no carry): 0001 = 1
  AND + shift:   10000 = 16 (carry)

Step 3:
   1 in binary:  00001
  16 in binary:  10000
  XOR (no carry): 10001 = 17
  AND + shift:    00000 = 0 (no carry — done!)

Result: 17 ✓
```

#### Complexity Analysis

- **Time Complexity:** O(1) — at most 32 iterations for 32-bit integers
- **Space Complexity:** O(1)

---

## Common Pitfalls

### 1. Forgetting to Return

**Wrong:**
```java
public int sum(int num1, int num2) {
    num1 + num2;  // Missing return statement!
}
```

**Correct:**
```java
public int sum(int num1, int num2) {
    return num1 + num2;
}
```

### 2. Python `self` Parameter

**Wrong:**
```python
def sum(num1: int, num2: int) -> int:  # Missing self!
    return num1 + num2
```

**Correct:**
```python
def sum(self, num1: int, num2: int) -> int:
    return num1 + num2
```

---

## Summary

| Approach | Time | Space | Notes |
|----------|------|-------|-------|
| Direct addition | O(1) | O(1) | Simplest and best |
| Bit manipulation | O(1) | O(1) | Educational — no `+` operator |

The direct addition approach is the optimal solution. The bit manipulation approach is included as an educational exercise that demonstrates how computers perform addition at the hardware level.
