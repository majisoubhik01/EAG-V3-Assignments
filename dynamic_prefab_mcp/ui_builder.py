from __future__ import annotations

import json
import re
from pathlib import Path

from core import file_crud


HERE = Path(__file__).parent
GENERATED = HERE / "generated_app.py"


def _slug(value: str, default: str = "tab") -> str:
    slug = re.sub(r"[^a-zA-Z0-9_]+", "_", str(value)).strip("_").lower()
    return slug or default


def _py(value) -> str:
    return repr("" if value is None else value)


def _widget_lines(widget: dict) -> list[str]:
    kind = widget.get("kind", "text")

    if kind == "stat":
        return [
            "with Card():",
            "    with CardContent():",
            "        with Column(gap=1):",
            f"            Muted({_py(widget.get('label', 'Metric'))})",
            f"            H1({_py(widget.get('value', ''))})",
            f"            Muted({_py(widget.get('sub', ''))})",
        ]

    if kind == "table":
        columns = widget.get("columns", [])
        rows = widget.get("rows", [])
        out = [
            "with Card():",
            "    with CardHeader():",
            f"        CardTitle({_py(widget.get('title', 'Table'))})",
            "    with CardContent():",
            "        with Column(gap=2):",
        ]
        if columns:
            out.append("            with Row(gap=3):")
            for col in columns:
                out.append(f"                Text({_py(col)})")
        for row in rows:
            cells = row if isinstance(row, list) else [row.get(c, "") for c in columns]
            out.append("            with Row(gap=3):")
            for cell in cells:
                out.append(f"                Muted({_py(cell)})")
        return out

    if kind == "list":
        items = widget.get("items", [])
        out = [
            "with Card():",
            "    with CardHeader():",
            f"        CardTitle({_py(widget.get('title', 'List'))})",
            "    with CardContent():",
            "        with Column(gap=2):",
        ]
        for item in items:
            out.append(f"            Text({_py(item)})")
        if not items:
            out.append("            Muted('No items')")
        return out

    if kind == "badges":
        out = [
            "with Card():",
            "    with CardContent():",
            "        with Row(gap=2):",
        ]
        for item in widget.get("items", []):
            label = item.get("label", item) if isinstance(item, dict) else item
            variant = item.get("variant", "default") if isinstance(item, dict) else "default"
            out.append(f"            Badge({_py(label)}, variant={_py(variant)})")
        return out

    if kind == "bar":
        title = widget.get("title", "Bar chart")
        data = widget.get("data", [])
        x_key = widget.get("x_key", "x")
        y_keys = widget.get("y_keys", ["y"])
        if isinstance(y_keys, str):
            y_keys = [y_keys]
        series = ", ".join(
            f"ChartSeries(data_key={_py(key)}, label={_py(key)})"
            for key in y_keys
        )
        return [
            "with Card():",
            "    with CardHeader():",
            f"        CardTitle({_py(title)})",
            "    with CardContent():",
            f"        BarChart(data={repr(data)},",
            f"                 series=[{series}],",
            f"                 x_axis={_py(x_key)}, show_legend={len(y_keys) > 1})",
        ]

    if kind == "line":
        title = widget.get("title", "Line chart")
        data = widget.get("data", [])
        x_key = widget.get("x_key", "x")
        y_keys = widget.get("y_keys", ["y"])
        if isinstance(y_keys, str):
            y_keys = [y_keys]
        series = ", ".join(
            f"ChartSeries(data_key={_py(key)}, label={_py(key)})"
            for key in y_keys
        )
        return [
            "with Card():",
            "    with CardHeader():",
            f"        CardTitle({_py(title)})",
            "    with CardContent():",
            f"        LineChart(data={repr(data)},",
            f"                  series=[{series}],",
            f"                  x_axis={_py(x_key)}, show_legend={len(y_keys) > 1})",
        ]

    if kind == "pie":
        title = widget.get("title", "Pie chart")
        data = widget.get("data", [])
        name_key = widget.get("name_key", "name")
        value_key = widget.get("value_key", "value")
        return [
            "with Card():",
            "    with CardHeader():",
            f"        CardTitle({_py(title)})",
            "    with CardContent():",
            f"        PieChart(data={repr(data)}, data_key={_py(value_key)},",
            f"                 name_key={_py(name_key)}, show_legend=True)",
        ]

    if kind == "sparkline":
        title = widget.get("title", "Sparkline")
        values = widget.get("values", [])
        return [
            "with Card():",
            "    with CardHeader():",
            f"        CardTitle({_py(title)})",
            "    with CardContent():",
            f"        Sparkline(data={repr(values)})",
        ]

    heading = widget.get("heading") or widget.get("title") or "Notes"
    body = widget.get("body") or widget.get("text") or ""
    return [
        "with Card():",
        "    with CardHeader():",
        f"        CardTitle({_py(heading)})",
        "    with CardContent():",
        f"        Text({_py(body)})",
    ]


def _indent(lines: list[str], spaces: int) -> list[str]:
    prefix = " " * spaces
    return [prefix + line if line else "" for line in lines]


def hello_source() -> str:
    return "\n".join(
        [
            "from prefab_ui.app import PrefabApp",
            "from prefab_ui.components import Card, CardContent, CardHeader, CardTitle, Muted",
            "",
            'with PrefabApp(css_class="max-w-md mx-auto p-6") as app:',
            "    with Card():",
            "        with CardHeader():",
            '            CardTitle("Hello")',
            "        with CardContent():",
            '            Muted("Ask me what to fetch in the CLI.")',
            "",
        ]
    )


def dashboard_source(spec: dict) -> str:
    title = spec.get("title") or "Generated Dashboard"
    tabs = spec.get("tabs") or [
        {
            "name": "Results",
            "widgets": [
                {
                    "kind": "text",
                    "heading": "No results",
                    "body": "Ask for a website, topic, or file operation in the CLI.",
                }
            ],
        }
    ]
    files = file_crud("list").get("files", [])
    file_rows = [[name] for name in files]
    last_operation = spec.get("last_file_operation", "")

    parts = [
        "from prefab_ui.app import PrefabApp",
        "from prefab_ui.components import (",
        "    Badge, Card, CardContent, CardHeader, CardTitle, Column, H1,",
        "    H3, Muted, Row, Tab, Tabs, Text,",
        ")",
        "from prefab_ui.components.charts import (",
        "    BarChart, ChartSeries, LineChart, PieChart, Sparkline,",
        ")",
        "",
        'with PrefabApp(css_class="max-w-5xl mx-auto p-6") as app:',
        "    with Column(gap=5):",
        "        with Card():",
        "            with CardHeader():",
        f"                CardTitle({_py(title)})",
        "            with CardContent():",
        "                with Row(gap=2):",
        "                    Badge('LLM generated', variant='default')",
        "                    Badge('Internet tools', variant='secondary')",
        "                    Badge('Prefab UI', variant='success')",
        "        with Tabs(value='results'):",
    ]

    first = True
    for idx, tab in enumerate(tabs):
        name = tab.get("name") or f"Result {idx + 1}"
        value = "results" if first else _slug(name, f"tab_{idx + 1}")
        first = False
        parts.append(f"            with Tab({_py(name)}, value={_py(value)}):")
        parts.append("                with Column(gap=4):")
        for widget in tab.get("widgets", []):
            parts.extend(_indent(_widget_lines(widget), 20))

    parts.append("            with Tab('CRUD Files', value='crud_files'):")
    parts.append("                with Column(gap=4):")
    parts.extend(
        _indent(
            _widget_lines(
                {
                    "kind": "text",
                    "heading": "Local text files",
                    "body": last_operation or "This tab is fixed. It lists files created/read/updated/deleted by the CRUD tool.",
                }
            ),
            20,
        )
    )
    parts.extend(
        _indent(
            _widget_lines(
                {
                    "kind": "table",
                    "title": "files/",
                    "columns": ["Filename"],
                    "rows": file_rows,
                }
            ),
            20,
        )
    )
    return "\n".join(parts) + "\n"


def write_hello() -> None:
    GENERATED.write_text(hello_source(), encoding="utf-8")


def write_dashboard(spec_json: str) -> dict:
    spec = json.loads(spec_json)
    source = dashboard_source(spec)
    compile(source, "<generated_app>", "exec")
    GENERATED.write_text(source, encoding="utf-8")
    return spec
