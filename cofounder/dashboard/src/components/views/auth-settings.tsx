import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Shield, AlertCircle, CheckCircle, Settings } from 'lucide-react';
import { toast } from 'sonner';

interface AuthProvider {
	type: string;
	initialized: boolean;
	lastError?: {
		message: string;
		context: string;
		timestamp: number;
	};
	config: Record<string, any>;
}

interface AuthInfo {
	activeProvider: string | null;
	preferredProvider: string;
	fallbackEnabled: boolean;
	initialized: boolean;
	providers: Record<string, AuthProvider>;
}

export function AuthSettings() {
	const [authInfo, setAuthInfo] = useState<AuthInfo | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSwitching, setIsSwitching] = useState(false);
	const [isRefreshing, setIsRefreshing] = useState(false);

	useEffect(() => {
		fetchAuthInfo();
	}, []);

	const fetchAuthInfo = async () => {
		try {
			const response = await fetch('/api/auth/info');
			if (response.ok) {
				const data = await response.json();
				setAuthInfo(data);
			} else {
				console.error('Failed to fetch auth info');
			}
		} catch (error) {
			console.error('Error fetching auth info:', error);
		} finally {
			setIsLoading(false);
		}
	};

	const switchProvider = async (providerType: string) => {
		setIsSwitching(true);
		try {
			const response = await fetch('/api/auth/switch', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ provider: providerType }),
			});

			if (response.ok) {
				toast.success(`Switched to ${providerType} provider`);
				await fetchAuthInfo();
			} else {
				const error = await response.json();
				toast.error(`Failed to switch provider: ${error.error}`);
			}
		} catch (error) {
			toast.error('Error switching provider');
			console.error('Error switching provider:', error);
		} finally {
			setIsSwitching(false);
		}
	};

	const refreshProviders = async () => {
		setIsRefreshing(true);
		try {
			const response = await fetch('/api/auth/refresh', {
				method: 'POST',
			});

			if (response.ok) {
				toast.success('Providers refreshed');
				await fetchAuthInfo();
			} else {
				const error = await response.json();
				toast.error(`Failed to refresh providers: ${error.error}`);
			}
		} catch (error) {
			toast.error('Error refreshing providers');
			console.error('Error refreshing providers:', error);
		} finally {
			setIsRefreshing(false);
		}
	};

	const getProviderStatus = (provider: AuthProvider) => {
		if (!provider.initialized) {
			return { color: 'secondary', icon: AlertCircle, text: 'Not Initialized' };
		}
		if (provider.lastError) {
			return { color: 'destructive', icon: AlertCircle, text: 'Error' };
		}
		return { color: 'default', icon: CheckCircle, text: 'Ready' };
	};

	const getProviderDescription = (type: string) => {
		switch (type) {
			case 'api-key':
				return 'Direct API key authentication with OpenAI/Anthropic';
			case 'claude-session':
				return 'Use your Claude Code session token (subscription-based)';
			default:
				return 'Authentication provider';
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-64">
				<RefreshCw className="w-6 h-6 animate-spin" />
			</div>
		);
	}

	if (!authInfo) {
		return (
			<div className="flex items-center justify-center h-64">
				<p className="text-muted-foreground">Failed to load authentication info</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold">Authentication Settings</h2>
					<p className="text-muted-foreground">Manage your AI service authentication</p>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						onClick={refreshProviders}
						disabled={isRefreshing}
					>
						<RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
						Refresh
					</Button>
				</div>
			</div>

			{/* Current Status */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Shield className="w-5 h-5" />
						Current Status
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<span className="font-medium">Active Provider:</span>
							<Badge variant={authInfo.activeProvider ? 'default' : 'secondary'}>
								{authInfo.activeProvider || 'None'}
							</Badge>
						</div>
						<div className="flex items-center justify-between">
							<span className="font-medium">Fallback Enabled:</span>
							<Badge variant={authInfo.fallbackEnabled ? 'default' : 'secondary'}>
								{authInfo.fallbackEnabled ? 'Yes' : 'No'}
							</Badge>
						</div>
						<div className="flex items-center justify-between">
							<span className="font-medium">System Status:</span>
							<Badge variant={authInfo.initialized ? 'default' : 'destructive'}>
								{authInfo.initialized ? 'Initialized' : 'Not Initialized'}
							</Badge>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Provider Selection */}
			<Card>
				<CardHeader>
					<CardTitle>Switch Provider</CardTitle>
					<CardDescription>
						Choose your authentication method for AI services
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex items-center gap-4">
						<Select
							value={authInfo.activeProvider || ''}
							onValueChange={switchProvider}
							disabled={isSwitching}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Select authentication provider" />
							</SelectTrigger>
							<SelectContent>
								{Object.keys(authInfo.providers).map((providerType) => (
									<SelectItem key={providerType} value={providerType}>
										{providerType}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{isSwitching && <RefreshCw className="w-4 h-4 animate-spin" />}
					</div>
				</CardContent>
			</Card>

			{/* Available Providers */}
			<div className="space-y-4">
				<h3 className="text-lg font-semibold">Available Providers</h3>
				{Object.entries(authInfo.providers).map(([type, provider]) => {
					const status = getProviderStatus(provider);
					const StatusIcon = status.icon;
					
					return (
						<Card key={type} className={authInfo.activeProvider === type ? 'border-primary' : ''}>
							<CardHeader>
								<div className="flex items-center justify-between">
									<CardTitle className="flex items-center gap-2">
										<Settings className="w-4 h-4" />
										{type}
										{authInfo.activeProvider === type && (
											<Badge variant="default">Active</Badge>
										)}
									</CardTitle>
									<div className="flex items-center gap-2">
										<StatusIcon className="w-4 h-4" />
										<Badge variant={status.color as any}>
											{status.text}
										</Badge>
									</div>
								</div>
								<CardDescription>
									{getProviderDescription(type)}
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-2">
									{provider.config && Object.keys(provider.config).length > 0 && (
										<div>
											<p className="text-sm font-medium mb-2">Configuration:</p>
											<div className="bg-muted p-3 rounded text-sm space-y-1">
												{Object.entries(provider.config).map(([key, value]) => (
													<div key={key} className="flex justify-between">
														<span className="text-muted-foreground">{key}:</span>
														<span className="font-mono">
															{typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)}
														</span>
													</div>
												))}
											</div>
										</div>
									)}
									{provider.lastError && (
										<div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded">
											<p className="text-sm font-medium text-destructive">Last Error:</p>
											<p className="text-sm text-muted-foreground mt-1">
												{provider.lastError.message}
											</p>
											<p className="text-xs text-muted-foreground mt-1">
												Context: {provider.lastError.context} • {' '}
												{new Date(provider.lastError.timestamp).toLocaleString()}
											</p>
										</div>
									)}
								</div>
							</CardContent>
						</Card>
					);
				})}
			</div>

			{/* Help Section */}
			<Card>
				<CardHeader>
					<CardTitle>Setup Instructions</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div>
						<h4 className="font-semibold">API Key Provider</h4>
						<p className="text-sm text-muted-foreground mt-1">
							Set <code>OPENAI_API_KEY</code> and/or <code>ANTHROPIC_API_KEY</code> in your environment.
							This uses direct API billing.
						</p>
					</div>
					<div>
						<h4 className="font-semibold">Claude Session Provider</h4>
						<p className="text-sm text-muted-foreground mt-1">
							Make sure Claude Code is running and you're logged in. This uses your Claude subscription
							instead of per-token billing. Set <code>AUTH_PROVIDER=claude-session</code> in your .env file.
						</p>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

export default AuthSettings;