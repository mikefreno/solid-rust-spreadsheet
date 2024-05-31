import { type Setter } from "solid-js";
import { Cell } from "./utils";
import { Trie } from "~/core/trie";

export const setCellValue = (
  refStr: string,
  value: string,
  selectedCell: string,
  dependencyGraph: { [key: string]: Set<string> },
  data: Trie | undefined,
  setData: Setter<Trie | undefined>,
  getCell: (refStr: string) => Cell | undefined,
  setInputBarValue: Setter<string>,
  setDependencyGraph: Setter<{ [key: string]: Set<string> }>,
) => {
  const cell = getCell(refStr);
  if (cell && value !== undefined) {
    if (value.startsWith("=")) {
      setCellFormula(
        refStr,
        value,
        dependencyGraph,
        data,
        setData,
        getCell,
        setInputBarValue,
        setDependencyGraph,
      );
    } else {
      cell.value = value;
      cell.formula = null;
      if (refStr === selectedCell) {
        setInputBarValue(value); // Update input bar if the selected cell is updated
      }
      // Update dependent cells
      updateDependentCells(refStr, dependencyGraph, data, setData, getCell);
    }
  }
};

const updateDependentCells = (
  refStr: string,
  dependencyGraph: { [key: string]: Set<string> },
  data: Trie | undefined,
  setData: Setter<Trie | undefined>,
  getCell: (refStr: string) => Cell | undefined,
) => {
  const visited = new Set<string>();
  const stack = [refStr];
  while (stack.length > 0) {
    const currentRefStr = stack.pop()!;
    if (visited.has(currentRefStr)) continue;
    visited.add(currentRefStr);
    const dependentCellRefs = dependencyGraph[currentRefStr];
    if (dependentCellRefs) {
      dependentCellRefs.forEach((ref) => {
        const dependentCell = getCell(ref);
        if (dependentCell && dependentCell.formula) {
          evaluateCell(ref, data, setData, getCell);
          stack.push(ref);
        }
      });
    }
  }
};

const getDependencies = (formula: string): string[] => {
  const regex = /([A-Z]+[0-9]+)/g;
  const matches = formula.match(regex);
  return matches ? matches : [];
};

const updateDependencyGraph = (
  refStr: string,
  newFormula: string | null,
  dependencyGraph: { [key: string]: Set<string> },
  setDependencyGraph: Setter<{ [key: string]: Set<string> }>,
) => {
  const currentGraph = { ...dependencyGraph };
  for (const key in currentGraph) {
    currentGraph[key].delete(refStr);
  }
  if (newFormula) {
    const dependencies = getDependencies(newFormula);
    dependencies.forEach((dep) => {
      if (!currentGraph[dep]) {
        currentGraph[dep] = new Set<string>();
      }
      currentGraph[dep].add(refStr);
    });
  }
  setDependencyGraph(currentGraph);
};

const setCellFormula = (
  refStr: string,
  formula: string,
  dependencyGraph: { [key: string]: Set<string> },
  data: Trie | undefined,
  setData: Setter<Trie | undefined>,
  getCell: (refStr: string) => Cell | undefined,
  setInputBarValue: Setter<string>,
  setDependencyGraph: Setter<{ [key: string]: Set<string> }>,
) => {
  const cell = getCell(refStr);
  if (cell) {
    cell.formula = formula;
    evaluateCell(refStr, data, setData, getCell);
    setInputBarValue(formula);
    updateDependencyGraph(refStr, formula, dependencyGraph, setDependencyGraph); // Update dependency graph
  }
};

const evaluateCell = (
  refStr: string,
  data: Trie | undefined,
  setData: Setter<Trie | undefined>,
  getCell: (refStr: string) => Cell | undefined,
) => {
  const cell = getCell(refStr);
  if (cell && cell.formula) {
    const result = evaluateFormula(cell.formula, getCell);
    cell.value = result;
    const newData = new Trie();
    for (const [key, value] of Object.entries(data?.getAll() ?? {})) {
      newData.insert(value, key);
    }
    setData(newData);
  }
};

const evaluateFormula = (
  formula: string,
  getCell: (refStr: string) => Cell | undefined,
): string => {
  if (!formula.startsWith("=")) {
    return formula;
  }

  const isNumber = (token: string): boolean => {
    const startsWithMinus = token.startsWith("-") && token.length > 1;
    const restOfToken = startsWithMinus ? token.slice(1) : token;

    for (let i = 0; i < restOfToken.length; i++) {
      const charCode = restOfToken.charCodeAt(i);
      if (charCode < 48 || charCode > 57) {
        if (restOfToken[i] !== "." || i === 0 || i === restOfToken.length - 1) {
          return false;
        }
      }
    }
    return true;
  };

  const outputQueue: string[] = [];
  const operatorStack: string[] = [];
  const precedence: { [key: string]: number } = {
    "+": 1,
    "-": 1,
    "*": 2,
    "/": 2,
  };

  let currentToken: string = "";
  let i = 1; // Skip the '=' character
  const length = formula.length;

  while (i < length) {
    const ch = formula[i];
    if (ch === " ") {
      i++;
      continue;
    }
    if ("+-*/()".includes(ch)) {
      if (currentToken.length > 0) {
        if (isNumber(currentToken)) {
          outputQueue.push(currentToken);
        } else if (getCell(currentToken)) {
          outputQueue.push(currentToken);
        } else {
          return "invalid";
        }
        currentToken = "";
      }
      if (
        ch === "-" &&
        (i === 1 ||
          "(".includes(formula[i - 1]) ||
          "+-*/(".includes(formula[i - 1]))
      ) {
        operatorStack.push("u-"); // Push Unary minus
      } else if (ch === "(") {
        operatorStack.push(ch);
      } else if (ch === ")") {
        while (operatorStack.length > 0) {
          const op = operatorStack.pop();
          if (op === "(") break;
          outputQueue.push(op!);
        }
      } else {
        while (
          operatorStack.length > 0 &&
          precedence[operatorStack[operatorStack.length - 1]] >= precedence[ch]
        ) {
          outputQueue.push(operatorStack.pop()!);
        }
        operatorStack.push(ch);
      }
      i++;
    } else {
      currentToken += ch;
      i++;
    }
  }

  if (currentToken.length > 0) {
    if (isNumber(currentToken)) {
      outputQueue.push(currentToken);
    } else if (getCell(currentToken)) {
      outputQueue.push(currentToken);
    } else {
      return "invalid";
    }
  }

  while (operatorStack.length > 0) {
    outputQueue.push(operatorStack.pop()!);
  }

  const stack: number[] = [];
  for (const token of outputQueue) {
    if (isNumber(token)) {
      stack.push(Number(token));
    } else if (token === "u-") {
      // Handle unary minus
      stack.push(-stack.pop()!);
    } else if (getCell(token)) {
      const cell = getCell(token);
      if (cell && isNumber(cell.value.toString())) {
        stack.push(Number(cell.value));
      } else {
        return "invalid";
      }
    } else {
      const right = stack.pop()!;
      const left = stack.pop()!;
      let result = 0;
      switch (token) {
        case "+":
          result = left + right;
          break;
        case "-":
          result = left - right;
          break;
        case "*":
          result = left * right;
          break;
        case "/":
          if (right === 0) {
            return "#DIV/0!";
          }
          result = left / right;
          break;
        default:
          return "invalid";
      }
      stack.push(result);
    }
  }
  return (stack.pop() ?? "undefined").toString();
};
