import click
import json
from pathlib import Path
from ..analyzers.project_analyzer import ProjectAnalyzer

@click.command()
@click.argument('project_path', type=click.Path(exists=True))
@click.option('--output', '-o', type=click.Path(), help='Output file for the blueprint')
def analyze(project_path: str, output: str):
    """Analyze an existing project and generate a Cofounder blueprint"""
    analyzer = ProjectAnalyzer(project_path)
    blueprint = analyzer.analyze()
    
    if output:
        output_path = Path(output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w') as f:
            json.dump(blueprint, f, indent=2)
        click.echo(f"Blueprint saved to {output}")
    else:
        click.echo(json.dumps(blueprint, indent=2))