use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Clone, Default, Serialize, Deserialize)]
pub struct TrieNode {
    children: HashMap<String, TrieNode>,
    data: HashMap<String, Cell>,
}

#[wasm_bindgen]
#[derive(Clone, Default, Serialize, Deserialize)]
pub struct Trie {
    root: TrieNode,
}

#[wasm_bindgen]
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Cell {
    value: String,
    formula: Option<String>,
}

#[wasm_bindgen]
#[derive(Clone, Serialize, Deserialize)]
pub struct Spreadsheet {
    trie: Trie,
    dependency_graph: HashMap<String, HashSet<String>>,
}

#[wasm_bindgen]
impl Trie {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Trie {
            root: TrieNode::default(),
        }
    }

    #[wasm_bindgen]
    pub fn insert_cell(&mut self, value: String, formula: Option<String>, ref_str: &str) {
        let (col, row) = get_cell_ref_split(ref_str);
        self.insert(value, formula, col, row)
    }

    #[wasm_bindgen]
    pub fn insert(&mut self, value: String, formula: Option<String>, col: String, row: String) {
        let cell = Cell { value, formula };
        let mut current_node = &mut self.root;
        for char in col.chars() {
            current_node = current_node.children.entry(char.to_string()).or_default();
        }
        current_node.data.insert(row, cell);
    }

    #[wasm_bindgen]
    pub fn get_cell(&self, ref_str: &str) -> Result<JsValue, JsValue> {
        let (col, row) = get_cell_ref_split(ref_str);
        self.get(col, row)
    }

    #[wasm_bindgen]
    pub fn get(&self, col: String, row: String) -> Result<JsValue, JsValue> {
        let mut current_node = &self.root;
        for char in col.chars() {
            if let Some(node) = current_node.children.get(&char.to_string()) {
                current_node = node;
            } else {
                return Ok(serde_wasm_bindgen::to_value("")?);
            }
        }
        match current_node.data.get(&row) {
            Some(cell) => Ok(serde_wasm_bindgen::to_value(cell)?),
            None => Ok(serde_wasm_bindgen::to_value("")?),
        }
    }

    pub fn get_cell_internal(&self, ref_str: &str) -> Option<Cell> {
        let (col, row) = get_cell_ref_split(ref_str);
        self.get_internal(&col, &row)
    }

    pub fn get_internal(&self, col: &str, row: &str) -> Option<Cell> {
        let mut current_node = &self.root;
        for char in col.chars() {
            if let Some(node) = current_node.children.get(&char.to_string()) {
                current_node = node;
            } else {
                return None;
            }
        }
        current_node.data.get(row).cloned()
    }
}

#[wasm_bindgen]
impl Spreadsheet {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            trie: Trie::new(),
            dependency_graph: HashMap::new(),
        }
    }

    #[wasm_bindgen]
    pub fn get_cell(&self, ref_str_from_js: JsValue) -> Result<JsValue, JsValue> {
        let ref_str: String = match ref_str_from_js.as_string() {
            Some(s) => s,
            None => "".to_string(),
        };
        self.trie.get_cell(&ref_str)
    }

    #[wasm_bindgen]
    pub fn get_cell_split(
        &self,
        col_from_js: usize,
        row_from_js: usize,
    ) -> Result<JsValue, JsValue> {
        let col = get_column_header(col_from_js);
        let row = (row_from_js+1).to_string();
        self.trie.get(col, row)
    }

    #[wasm_bindgen]
    pub fn set_cell_value(&mut self, ref_str_from_js: JsValue, value_from_js: JsValue) -> Self {
        let ref_str: String = match ref_str_from_js.as_string() {
            Some(s) => s,
            None => "".to_string(),
        };
        let value: String = match value_from_js.as_string() {
            Some(s) => s,
            None => "".to_string(),
        };

        if value.starts_with('=') {
            self.set_cell_formula(&ref_str, &value);
        } else {
            self.trie.insert_cell(value.to_owned(), None, &ref_str);
        }

        self.update_dependent_cells(&ref_str);

        self.clone()
    }

    #[wasm_bindgen]
    pub fn init_cell(&mut self, ref_str_from_js: JsValue, value_from_js: JsValue) {
        let ref_str: String = match ref_str_from_js.as_string() {
            Some(s) => s,
            None => "".to_string(),
        };
        let value: String = match value_from_js.as_string() {
            Some(s) => s,
            None => "".to_string(),
        };
        self.trie.insert_cell(value.to_owned(), None, &ref_str);
    }

    #[wasm_bindgen]
    pub fn update_dependent_cells(&mut self, ref_str: &str) {
        let mut visited = HashSet::new();
        let mut stack = vec![ref_str.to_string()];
        while let Some(current_ref_str) = stack.pop() {
            if visited.contains(&current_ref_str) {
                continue;
            }
            visited.insert(current_ref_str.clone());
            if let Some(dependent_cell_refs) = self.dependency_graph.get(&current_ref_str) {
                for ref_str in dependent_cell_refs {
                    if let Some(dependent_cell) = self.trie.get_cell_internal(ref_str) {
                        if dependent_cell.formula.is_some() {
                            if let Ok(updated_cell) = self.evaluate_cell(ref_str) {
                                self.trie.insert_cell(
                                    updated_cell.value,
                                    updated_cell.formula,
                                    ref_str,
                                );
                                stack.push(ref_str.clone());
                            }
                        }
                    }
                }
            }
        }
    }

    #[wasm_bindgen]
    pub fn get_dependencies(&self, formula: &str) -> Vec<String> {
        let regex = regex::Regex::new(r"([A-Z]+[0-9]+)").unwrap();
        regex
            .find_iter(formula)
            .map(|m| m.as_str().to_string())
            .collect()
    }

    fn update_dependency_graph(&mut self, ref_str: &str, new_formula: Option<&str>) {
        for (_, dependent_cell_refs) in self.dependency_graph.iter_mut() {
            dependent_cell_refs.remove(ref_str);
        }
        if let Some(new_formula) = new_formula {
            for dep in self.get_dependencies(new_formula) {
                self.dependency_graph
                    .entry(dep)
                    .or_insert(HashSet::new())
                    .insert(ref_str.to_string());
            }
        }
    }

    fn set_cell_formula(&mut self, ref_str: &str, formula: &str) {
        if let Some(mut cell) = self.trie.get_cell_internal(ref_str) {
            cell.formula = Some(formula.to_string());
            let result = self.evaluate_formula(formula);
            cell.value = result.clone();
            self.trie
                .insert_cell(result, Some(formula.to_string()), ref_str);
            self.update_dependency_graph(ref_str, Some(formula));
            self.update_dependent_cells(ref_str);
        }
    }

    fn evaluate_cell(&self, ref_str: &str) -> Result<Cell, &'static str> {
        if let Some(mut cell) = self.trie.get_cell_internal(ref_str) {
            if let Some(formula) = &cell.formula {
                let result = self.evaluate_formula(formula);
                cell.value = result;
                Ok(cell)
            } else {
                Err("Formula is None")
            }
        } else {
            Err("Cell not found")
        }
    }

    fn evaluate_formula(&self, formula: &str) -> String {
        // Check if the formula starts with "="
        if !formula.starts_with('=') {
            return formula.to_string();
        }

        // Helper function to check if a token is a number
        fn is_number(token: &str) -> bool {
            if token.starts_with('-') && token.len() > 1 {
                token[1..].chars().all(|c| c.is_digit(10) || c == '.')
            } else {
                token.chars().all(|c| c.is_digit(10) || c == '.')
            }
        }

        let mut output_queue: Vec<String> = Vec::new();
        let mut operator_stack: Vec<String> = Vec::new();
        let precedence: HashMap<String, i32> = HashMap::from([
            ("+".to_string(), 1),
            ("-".to_string(), 1),
            ("*".to_string(), 2),
            ("/".to_string(), 2),
        ]);

        let mut current_token = String::new();
        let chars: Vec<char> = formula.chars().collect();
        let mut i = 1; // Skip the '=' character
        let length = chars.len();

        while i < length {
            let ch = chars[i];
            if ch.is_whitespace() {
                i += 1;
                continue;
            }
            if "+-*/()".contains(ch) {
                if !current_token.is_empty() {
                    if is_number(&current_token) {
                        output_queue.push(current_token.clone());
                    } else if self.trie.get_cell_internal(&current_token).is_some() {
                        output_queue.push(current_token.clone());
                    } else {
                        return "invalid".to_string();
                    }
                    current_token.clear();
                }
                if ch == '-' && (i == 1 || "+-*/(".contains(chars[i - 1])) {
                    operator_stack.push("u-".to_string()); // Push Unary minus
                } else if ch == '(' {
                    operator_stack.push(ch.to_string());
                } else if ch == ')' {
                    while let Some(op) = operator_stack.pop() {
                        if op == "(" {
                            break;
                        }
                        output_queue.push(op);
                    }
                } else {
                    while let Some(top_op) = operator_stack.last() {
                        if precedence.get(top_op).unwrap_or(&0)
                            >= precedence.get(&ch.to_string()).unwrap_or(&0)
                        {
                            output_queue.push(operator_stack.pop().unwrap());
                        } else {
                            break;
                        }
                    }
                    operator_stack.push(ch.to_string());
                }
                i += 1;
            } else {
                current_token.push(ch);
                i += 1;
            }
        }

        if !current_token.is_empty() {
            if is_number(&current_token) {
                output_queue.push(current_token.clone());
            } else if self.trie.get_cell_internal(&current_token).is_some() {
                output_queue.push(current_token.clone());
            } else {
                return "invalid".to_string();
            }
        }

        while let Some(op) = operator_stack.pop() {
            output_queue.push(op);
        }

        let mut stack: Vec<f64> = Vec::new();
        for token in output_queue {
            if is_number(&token) {
                stack.push(token.parse::<f64>().unwrap());
            } else if token == "u-" {
                if let Some(num) = stack.pop() {
                    stack.push(-num);
                }
            } else if self.trie.get_cell_internal(&token).is_some() {
                if let Some(cell) = self.trie.get_cell_internal(&token) {
                    if is_number(&cell.value) {
                        stack.push(cell.value.parse::<f64>().unwrap());
                    } else {
                        return "invalid".to_string();
                    }
                }
            } else {
                let right = stack.pop().unwrap();
                let left = stack.pop().unwrap();
                let result = match token.as_str() {
                    "+" => left + right,
                    "-" => left - right,
                    "*" => left * right,
                    "/" => {
                        if right == 0.0 {
                            return "#DIV/0!".to_string();
                        }
                        left / right
                    }
                    _ => return "invalid".to_string(),
                };
                stack.push(result);
            }
        }

        match stack.pop() {
            Some(val) => val.to_string(),
            None => "undefined".to_string(),
        }
    }
}

pub fn get_cell_ref_split(ref_str: &str) -> (String, String) {
    let mut col_of_cell = String::new();
    let mut row_of_cell = String::new();

    for char in ref_str.chars() {
        if char.is_ascii_uppercase() {
            col_of_cell.push(char);
        } else {
            row_of_cell = ref_str[ref_str.find(char).unwrap()..].to_string();
            break;
        }
    }

    (col_of_cell, row_of_cell)
}
pub fn get_column_header(col_index: usize) -> String {
    let mut label = String::new();
    let mut n = col_index + 1;

    while n > 0 {
        let remainder = (n - 1) % 26;
        label = format!("{}{}", (65 + remainder as u8) as char, label);
        n = (n - 1) / 26;
    }

    label
}
