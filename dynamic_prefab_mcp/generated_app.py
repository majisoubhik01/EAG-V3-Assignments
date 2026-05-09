from prefab_ui.app import PrefabApp
from prefab_ui.components import (
    Badge, Card, CardContent, CardHeader, CardTitle, Column, H1,
    H3, Muted, Row, Tab, Tabs, Text,
)
from prefab_ui.components.charts import (
    BarChart, ChartSeries, LineChart, PieChart, Sparkline,
)

with PrefabApp(css_class="max-w-5xl mx-auto p-6") as app:
    with Column(gap=5):
        with Card():
            with CardHeader():
                CardTitle('UEFA Champions League & Election Data')
            with CardContent():
                with Row(gap=2):
                    Badge('LLM generated', variant='default')
                    Badge('Internet tools', variant='secondary')
                    Badge('Prefab UI', variant='success')
        with Tabs(value='results'):
            with Tab('UCL Data', value='results'):
                with Column(gap=4):
                    with Card():
                        with CardHeader():
                            CardTitle('Top 5 Clubs by Titles')
                        with CardContent():
                            PieChart(data=[{'name': 'Real Madrid', 'value': 15}, {'name': 'Milan', 'value': 7}, {'name': 'Bayern Munich', 'value': 6}, {'name': 'Liverpool', 'value': 6}, {'name': 'Barcelona', 'value': 5}], data_key='value',
                                     name_key='name', show_legend=True)
                    with Card():
                        with CardHeader():
                            CardTitle('Recent UCL Winners')
                        with CardContent():
                            with Column(gap=2):
                                with Row(gap=3):
                                    Text('Season')
                                    Text('Winner')
                                with Row(gap=3):
                                    Muted('2024-25')
                                    Muted('Paris Saint-Germain')
                                with Row(gap=3):
                                    Muted('2023-24')
                                    Muted('Real Madrid')
                                with Row(gap=3):
                                    Muted('2022-23')
                                    Muted('Manchester City')
                                with Row(gap=3):
                                    Muted('2021-22')
                                    Muted('Real Madrid')
                                with Row(gap=3):
                                    Muted('2020-21')
                                    Muted('Chelsea')
            with Tab('Election Data', value='election_data'):
                with Column(gap=4):
                    with Card():
                        with CardContent():
                            with Column(gap=1):
                                Muted('Voter Turnout')
                                H1('92.93%')
                                Muted('2026 WB Election')
                    with Card():
                        with CardHeader():
                            CardTitle('Seats Won')
                        with CardContent():
                            BarChart(data=[{'party': 'BJP', 'seats': 207}, {'party': 'AITC', 'seats': 80}],
                                     series=[ChartSeries(data_key='seats', label='seats')],
                                     x_axis='party', show_legend=False)
            with Tab('CRUD Files', value='crud_files'):
                with Column(gap=4):
                    with Card():
                        with CardHeader():
                            CardTitle('WBelections.txt')
                        with CardContent():
                            Text('2026 West Bengal Legislative Assembly Election Vote Shares:\n- Bharatiya Janata Party (BJP): 45.84%\n- All India Trinamool Congress (AITC): 40.8%\n- Others: 13.36%')
            with Tab('CRUD Files', value='crud_files'):
                with Column(gap=4):
                    with Card():
                        with CardHeader():
                            CardTitle('Local text files')
                        with CardContent():
                            Text('This tab is fixed. It lists files created/read/updated/deleted by the CRUD tool.')
                    with Card():
                        with CardHeader():
                            CardTitle('files/')
                        with CardContent():
                            with Column(gap=2):
                                with Row(gap=3):
                                    Text('Filename')
                                with Row(gap=3):
                                    Muted('WBelections.txt')
                                with Row(gap=3):
                                    Muted('alias_test.txt')
                                with Row(gap=3):
                                    Muted('cr7.txt')
                                with Row(gap=3):
                                    Muted('demo_example.txt')
                                with Row(gap=3):
                                    Muted('example_summary.txt')
                                with Row(gap=3):
                                    Muted('smoke.txt')
                                with Row(gap=3):
                                    Muted('ucl_winners.txt')
