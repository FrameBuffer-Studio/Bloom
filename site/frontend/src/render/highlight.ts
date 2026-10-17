type TokenClass = "comment" | "string" | "number" | "keyword" | "literal" | "builtin" | "function" | "property" | "operator" | "flag" | "plain";

interface Token {
  readonly value: string;
  readonly type: TokenClass;
}

interface Rule {
  readonly pattern: RegExp;
  readonly type: TokenClass | "identifier";
}

interface Grammar {
  readonly rules: readonly Rule[];
  readonly keywords: ReadonlySet<string>;
  readonly literals: ReadonlySet<string>;
  readonly builtins: ReadonlySet<string>;
}

const words = (list: string): ReadonlySet<string> => new Set(list.split(" "));

const LUAU: Grammar = {
  rules: [
    { pattern: /--\[(=*)\[[\s\S]*?\]\1\]/y, type: "comment" },
    { pattern: /--[^\n]*/y, type: "comment" },
    { pattern: /\[(=*)\[[\s\S]*?\]\1\]/y, type: "string" },
    { pattern: /"(?:[^"\\\n]|\\.)*"?/y, type: "string" },
    { pattern: /'(?:[^'\\\n]|\\.)*'?/y, type: "string" },
    { pattern: /`(?:[^`\\]|\\.)*`?/y, type: "string" },
    { pattern: /0[xX][\da-fA-F_]+|0[bB][01_]+|\d[\d_]*(?:\.[\d_]*)?(?:[eE][+-]?\d+)?|\.\d[\d_]*/y, type: "number" },
    { pattern: /[A-Za-z_]\w*/y, type: "identifier" },
    { pattern: /\.\.\.|[+\-*/%^#=<>~]=?|::|->|[:.,;(){}[\]|&?]/y, type: "operator" },
  ],
  keywords: words("local function end if then else elseif for in do while repeat until return break continue and or not export type typeof"),
  literals: words("nil true false self"),
  builtins: words(
    "game workspace script buffer bit32 math string table utf8 os task coroutine debug Vector2 Vector3 UDim UDim2 Color3 CFrame Instance Enum Content require print warn error assert pcall xpcall tostring tonumber setmetatable getmetatable ipairs pairs select type Bloom Color4 canvas",
  ),
};

const PYTHON: Grammar = {
  rules: [
    { pattern: /#[^\n]*/y, type: "comment" },
    { pattern: /[rbfu]{0,2}("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?)/iy, type: "string" },
    { pattern: /\d[\d_]*(?:\.\d+)?/y, type: "number" },
    { pattern: /[A-Za-z_]\w*/y, type: "identifier" },
    { pattern: /[+\-*/%=<>!:.,;(){}[\]|&@]+/y, type: "operator" },
  ],
  keywords: words("import from as def return for in if elif else while with open not and or is lambda class try except finally raise pass break continue yield"),
  literals: words("None True False self"),
  builtins: words("print len range open str int bytes list dict set sys"),
};

const SHELL: Grammar = {
  rules: [
    { pattern: /#[^\n]*/y, type: "comment" },
    { pattern: /"(?:[^"\\]|\\.)*"?|'[^']*'?/y, type: "string" },
    { pattern: /(?<=\s|^)--?[\w-]+/y, type: "flag" },
    { pattern: /[A-Za-z_][\w./-]*/y, type: "identifier" },
    { pattern: /[|&;<>()=$]+/y, type: "operator" },
  ],
  keywords: words("if then else fi for do done while case esac export"),
  literals: words("true false"),
  builtins: words("npm node lune rokit luau-lsp docker git cd echo curl"),
};

const GRAMMARS: Readonly<Record<string, Grammar>> = {
  lua: LUAU,
  luau: LUAU,
  python: PYTHON,
  py: PYTHON,
  bash: SHELL,
  sh: SHELL,
  shell: SHELL,
};

function classify(grammar: Grammar, value: string, source: string, start: number, end: number): TokenClass {
  if (grammar.keywords.has(value)) {
    return "keyword";
  }
  if (grammar.literals.has(value)) {
    return "literal";
  }
  const before = source[start - 1];
  const after = /^\s*\(/.test(source.slice(end, end + 8));
  if (after) {
    return "function";
  }
  if (before === "." || before === ":") {
    return "property";
  }
  return grammar.builtins.has(value) ? "builtin" : "plain";
}

function tokenize(grammar: Grammar, source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  let plain = "";

  const flushPlain = (): void => {
    if (plain !== "") {
      tokens.push({ value: plain, type: "plain" });
      plain = "";
    }
  };

  while (index < source.length) {
    let matched = false;
    for (const rule of grammar.rules) {
      rule.pattern.lastIndex = index;
      const match = rule.pattern.exec(source);
      if (match === null || match[0] === "") {
        continue;
      }
      const value = match[0];
      const end = index + value.length;
      const type = rule.type === "identifier" ? classify(grammar, value, source, index, end) : rule.type;
      if (type === "plain") {
        plain += value;
      } else {
        flushPlain();
        tokens.push({ value, type });
      }
      index = end;
      matched = true;
      break;
    }
    if (!matched) {
      plain += source[index] ?? "";
      index += 1;
    }
  }

  flushPlain();
  return tokens;
}

export function highlight(code: string, language: string): DocumentFragment {
  const result = document.createDocumentFragment();
  const grammar = GRAMMARS[language];
  if (grammar === undefined) {
    result.append(code);
    return result;
  }

  for (const token of tokenize(grammar, code)) {
    if (token.type === "plain") {
      result.append(token.value);
    } else {
      const span = document.createElement("span");
      span.className = `tok-${token.type}`;
      span.textContent = token.value;
      result.append(span);
    }
  }
  return result;
}
