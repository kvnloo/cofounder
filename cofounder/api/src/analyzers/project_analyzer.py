import os
import yaml
import json
import ast
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

class ProjectAnalyzer:
    def __init__(self, project_path: str):
        self.project_path = Path(project_path)
        self.db_schemas: Dict = {}
        self.api_specs: Dict = {}
        self.frontend_components: Dict = {}
        self.dependencies: Dict = {}
        self.routes: List[str] = []
        
    def analyze(self) -> Dict:
        """Analyze an existing project and extract its structure"""
        self._find_database_schemas()
        self._find_api_endpoints()
        self._find_frontend_components()
        self._find_dependencies()
        return self._generate_blueprint()
    
    def _find_database_schemas(self):
        """Extract database schema information from models/schemas/migrations"""
        # Look for common model file patterns
        model_patterns = [
            "**/models.py",
            "**/models/*.py",
            "**/schemas.py",
            "**/schemas/*.py",
            "**/migrations/*.py"
        ]
        
        models = []
        for pattern in model_patterns:
            models.extend(list(self.project_path.glob(pattern)))
            
        for model_file in models:
            with open(model_file) as f:
                try:
                    tree = ast.parse(f.read())
                    for node in ast.walk(tree):
                        if isinstance(node, ast.ClassDef):
                            # Look for model classes with typical ORM patterns
                            if any(base.id in ['Model', 'BaseModel'] for base in node.bases if isinstance(base, ast.Name)):
                                fields = []
                                for child in node.body:
                                    if isinstance(child, ast.AnnAssign):
                                        field_name = child.target.id
                                        field_type = ast.unparse(child.annotation)
                                        fields.append({"name": field_name, "type": field_type})
                                
                                self.db_schemas[node.name] = {
                                    "fields": fields,
                                    "file": str(model_file.relative_to(self.project_path))
                                }
                except:
                    continue

    def _find_api_endpoints(self):
        """Extract API endpoint information from routes/controllers"""
        # Look for common API file patterns
        api_patterns = [
            "**/routes.py",
            "**/routes/*.py",
            "**/views.py",
            "**/views/*.py",
            "**/controllers.py",
            "**/controllers/*.py"
        ]
        
        endpoints = []
        for pattern in api_patterns:
            endpoints.extend(list(self.project_path.glob(pattern)))
            
        for endpoint_file in endpoints:
            with open(endpoint_file) as f:
                try:
                    tree = ast.parse(f.read())
                    for node in ast.walk(tree):
                        if isinstance(node, ast.FunctionDef):
                            # Look for route decorators
                            for decorator in node.decorator_list:
                                if isinstance(decorator, ast.Call):
                                    if any(name in ast.unparse(decorator.func) for name in ['route', 'get', 'post', 'put', 'delete']):
                                        route = ast.literal_eval(decorator.args[0]) if decorator.args else "/"
                                        method = decorator.func.attr if hasattr(decorator.func, 'attr') else 'GET'
                                        self.api_specs[f"{method} {route}"] = {
                                            "function": node.name,
                                            "file": str(endpoint_file.relative_to(self.project_path))
                                        }
                except:
                    continue

    def _find_frontend_components(self):
        """Extract frontend component information from React/Vue files"""
        # Look for common frontend file patterns
        frontend_patterns = [
            "**/*.tsx",
            "**/*.jsx",
            "**/*.vue",
            "**/routes.ts",
            "**/router.ts"
        ]
        
        components = []
        for pattern in frontend_patterns:
            components.extend(list(self.project_path.glob(pattern)))
            
        for component_file in components:
            file_ext = component_file.suffix
            
            if file_ext in ['.tsx', '.jsx']:
                with open(component_file) as f:
                    try:
                        content = f.read()
                        # Basic React component detection
                        if 'export default' in content or 'React.FC' in content:
                            component_name = component_file.stem
                            self.frontend_components[component_name] = {
                                "type": "component",
                                "file": str(component_file.relative_to(self.project_path))
                            }
                            
                            # Extract routes if this is a router file
                            if 'Route' in content or 'Routes' in content:
                                self.routes.append(str(component_file.relative_to(self.project_path)))
                    except:
                        continue
            
            elif file_ext == '.vue':
                with open(component_file) as f:
                    try:
                        content = f.read()
                        # Basic Vue component detection
                        if '<template>' in content:
                            component_name = component_file.stem
                            self.frontend_components[component_name] = {
                                "type": "component",
                                "file": str(component_file.relative_to(self.project_path))
                            }
                    except:
                        continue

    def _find_dependencies(self):
        """Extract dependency information from package.json/requirements.txt"""
        package_files = [
            "package.json",
            "requirements.txt",
            "pyproject.toml",
            "poetry.lock"
        ]
        
        for file in package_files:
            dep_file = self.project_path / file
            if dep_file.exists():
                with open(dep_file) as f:
                    if file == "package.json":
                        try:
                            data = json.load(f)
                            self.dependencies["npm"] = {
                                "dependencies": data.get("dependencies", {}),
                                "devDependencies": data.get("devDependencies", {})
                            }
                        except:
                            continue
                    elif file == "requirements.txt":
                        try:
                            self.dependencies["pip"] = {
                                "dependencies": [line.strip() for line in f if line.strip() and not line.startswith("#")]
                            }
                        except:
                            continue
                    elif file in ["pyproject.toml", "poetry.lock"]:
                        try:
                            self.dependencies["poetry"] = {
                                "file": file,
                                "content": f.read()
                            }
                        except:
                            continue

    def _generate_blueprint(self) -> Dict:
        """Generate a Cofounder blueprint from the analyzed project structure"""
        blueprint = {
            # PM Documents
            "pm.details": {
                "type": "yaml",
                "content": yaml.dump({
                    "project_path": str(self.project_path),
                    "analyzed_at": "auto-generated from existing project"
                })
            },
            
            # Database
            "db.schemas": {
                "type": "yaml",
                "content": yaml.dump(self.db_schemas)
            },
            
            # Backend
            "backend.specifications.openapi": {
                "type": "complex",
                "content": {
                    "openapi": "3.0.0",
                    "info": {
                        "title": f"{self.project_path.name} API",
                        "version": "1.0.0"
                    },
                    "paths": {
                        endpoint: {
                            method.lower(): {
                                "summary": f"{spec['function']}",
                                "operationId": spec['function'],
                                "responses": {
                                    "200": {
                                        "description": "Successful response"
                                    }
                                }
                            }
                        }
                        for endpoint, spec in self.api_specs.items()
                        for method in [endpoint.split()[0]]
                    }
                }
            },
            
            # Frontend
            "uxsitemap.structure": {
                "type": "yaml",
                "content": yaml.dump({
                    "routes": self.routes,
                    "components": self.frontend_components
                })
            },
            
            # Settings
            "settings.config.package": {
                "type": "yaml",
                "content": yaml.dump(self.dependencies)
            }
        }
        
        return blueprint