export interface Cell {
  value: string;
  formula: string | null;
}

export const getCellRefSplit = (refStr: string) => {
  let colOfCell = "";
  let rowOfCell = "";

  for (let i = 0; i < refStr.length; i++) {
    const charCode = refStr.charCodeAt(i);
    if (charCode >= 65 && charCode <= 90) {
      colOfCell += refStr[i];
    } else {
      rowOfCell = refStr.slice(i);
      break;
    }
  }

  return { colOfCell, rowOfCell };
};

export const getColumnHeaderIndex = (header: string) => {
  let index = 0;
  for (let i = 0; i < header.length; i++) {
    index += (header.charCodeAt(i) - 64) * Math.pow(26, header.length - i - 1);
  }
  return index - 1;
};
export const getColumnHeader = (colIndex: number): string => {
  let label = "";
  let n = colIndex + 1;

  while (n > 0) {
    let remainder = (n - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    n = Math.floor((n - 1) / 26);
  }

  return label;
};
