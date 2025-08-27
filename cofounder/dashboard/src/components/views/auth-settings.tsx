import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Shield, AlertCircle, CheckCircle, Settings, ExternalLink, LogIn, LogOut } from 'lucide-react';
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
	const [oauthStatus, setOauthStatus] = useState<any>(null);
	const [isOAuthLoading, setIsOAuthLoading] = useState(false);
	
	const SERVER_LOCAL_URL = "http://localhost:4200/api";

	useEffect(() => {
		fetchAuthInfo();
		fetchOAuthStatus();
	}, []);

	const fetchAuthInfo = async () => {
		try {
			const response = await fetch(`${SERVER_LOCAL_URL}/auth/info`);
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
			const response = await fetch(`${SERVER_LOCAL_URL}/auth/switch`, {
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
			const response = await fetch(`${SERVER_LOCAL_URL}/auth/refresh`, {
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

	const fetchOAuthStatus = async () => {
		setIsOAuthLoading(true);
		try {
			const response = await fetch(`${SERVER_LOCAL_URL}/auth/oauth/status`);
			if (response.ok) {
				const data = await response.json();
				setOauthStatus(data);
			}
		} catch (error) {
			console.error('Error fetching OAuth status:', error);
		} finally {
			setIsOAuthLoading(false);
		}
	};

	const startOAuthFlow = async () => {
		try {
			const response = await fetch(`${SERVER_LOCAL_URL}/auth/oauth/start`, {
				method: 'POST',
			});

			if (response.ok) {
				const data = await response.json();
				// Open the OAuth URL in a new window
				window.open(data.authUrl, '_blank', 'width=500,height=600');
				toast.success('OAuth flow started. Please complete authentication in the popup window.');
				
				// Poll for completion
				const pollInterval = setInterval(async () => {
					const statusResponse = await fetch(`${SERVER_LOCAL_URL}/auth/oauth/status`);
					if (statusResponse.ok) {
						const statusData = await statusResponse.json();
						if (statusData.isAuthenticated) {
							clearInterval(pollInterval);
							await fetchOAuthStatus();
							await fetchAuthInfo();
							toast.success('Successfully authenticated with Claude!');
						}
					}
				}, 2000);

				// Stop polling after 5 minutes
				setTimeout(() => {
					clearInterval(pollInterval);
				}, 300000);
			} else {
				const error = await response.json();
				toast.error(`Failed to start OAuth flow: ${error.error}`);
			}
		} catch (error) {
			toast.error('Error starting OAuth flow');
			console.error('Error starting OAuth flow:', error);
		}
	};

	const logoutOAuth = async () => {
		try {
			const response = await fetch(`${SERVER_LOCAL_URL}/auth/oauth/logout`, {
				method: 'DELETE',
			});

			if (response.ok) {
				await fetchOAuthStatus();
				await fetchAuthInfo();
				toast.success('Successfully logged out');
			} else {
				const error = await response.json();
				toast.error(`Failed to logout: ${error.error}`);
			}
		} catch (error) {
			toast.error('Error during logout');
			console.error('Error during logout:', error);
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
			case 'claude-code-cli':
				return 'Use your local Claude Code CLI (recommended - leverages your existing authentication)';
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
					<h2 className="text-2xl font-bold text-[#ffffff]">Authentication Settings</h2>
					<p className="text-[#ccc]">Manage your AI service authentication</p>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="secondary"
						onClick={refreshProviders}
						disabled={isRefreshing}
						className="font-normal"
					>
						<RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
						Refresh
					</Button>
				</div>
			</div>

			{/* Current Status */}
			<Card className="bg-[#1a1a1a] border-[#333333]">
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-[#ffffff]">
						<Shield className="w-5 h-5 text-[#ffffff]" />
						Current Status
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<span className="font-medium text-[#ccc]">Active Provider:</span>
							<Badge variant={authInfo.activeProvider ? 'default' : 'secondary'}>
								{authInfo.activeProvider || 'None'}
							</Badge>
						</div>
						<div className="flex items-center justify-between">
							<span className="font-medium text-[#ccc]">Fallback Enabled:</span>
							<Badge variant={authInfo.fallbackEnabled ? 'default' : 'secondary'}>
								{authInfo.fallbackEnabled ? 'Yes' : 'No'}
							</Badge>
						</div>
						<div className="flex items-center justify-between">
							<span className="font-medium text-[#ccc]">System Status:</span>
							<Badge variant={authInfo.initialized ? 'default' : 'destructive'}>
								{authInfo.initialized ? 'Initialized' : 'Not Initialized'}
							</Badge>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Provider Selection */}
			<Card className="bg-[#1a1a1a] border-[#333333]">
				<CardHeader>
					<CardTitle className="text-[#ffffff]">Switch Provider</CardTitle>
					<CardDescription className="text-[#ccc]">
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
								{authInfo.providers && Object.keys(authInfo.providers).map((providerType) => (
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
				<h3 className="text-lg font-semibold text-[#ffffff]">Available Providers</h3>
				{authInfo.providers && Object.entries(authInfo.providers).map(([type, provider]) => {
					const status = getProviderStatus(provider);
					const StatusIcon = status.icon;
					
					return (
						<Card key={type} className={`bg-[#1a1a1a] border-[#333333] ${authInfo.activeProvider === type ? 'border-primary' : ''}`}>
							<CardHeader>
								<div className="flex items-center justify-between">
									<CardTitle className="flex items-center gap-2 text-[#ffffff]">
										<Settings className="w-4 h-4 text-[#ffffff]" />
										{type}
										{authInfo.activeProvider === type && (
											<Badge variant="default">Active</Badge>
										)}
									</CardTitle>
									<div className="flex items-center gap-2">
										<StatusIcon className="w-4 h-4 text-[#ffffff]" />
										<Badge variant={status.color as any}>
											{status.text}
										</Badge>
									</div>
								</div>
								<CardDescription className="text-[#ccc]">
									{getProviderDescription(type)}
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-2">
									{provider.config && Object.keys(provider.config).length > 0 && (
										<div>
											<p className="text-sm font-medium mb-2 text-[#ccc]">Configuration:</p>
											<div className="bg-[#222] p-3 rounded text-sm space-y-1">
												{Object.entries(provider.config).map(([key, value]) => (
													<div key={key} className="flex justify-between">
														<span className="text-[#999]">{key}:</span>
														<span className="font-mono text-[#ccc]">
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

			{/* OAuth Authentication */}
			<Card className="bg-[#1a1a1a] border-[#333333]">
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-[#ffffff]">
						<ExternalLink className="w-5 h-5 text-[#ffffff]" />
						Claude Account Authentication
					</CardTitle>
					<CardDescription className="text-[#ccc]">
						Login with your Claude account to use your subscription instead of API billing
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{oauthStatus && (
							<div className="flex items-center justify-between p-3 bg-[#222] rounded">
								<div className="flex items-center gap-2">
									{oauthStatus.isAuthenticated ? (
										<>
											<CheckCircle className="w-4 h-4 text-green-500" />
											<span className="text-[#ccc]">Authenticated as Claude user</span>
										</>
									) : (
										<>
											<AlertCircle className="w-4 h-4 text-yellow-500" />
											<span className="text-[#ccc]">Not authenticated</span>
										</>
									)}
								</div>
								{oauthStatus.isAuthenticated && (
									<Badge variant="default">Connected</Badge>
								)}
							</div>
						)}

						<div className="flex items-center gap-3">
							{!oauthStatus?.isAuthenticated ? (
								<Button
									onClick={startOAuthFlow}
									disabled={isOAuthLoading}
									className="font-normal"
									variant="default"
								>
									<LogIn className="w-4 h-4 mr-2" />
									{isOAuthLoading ? 'Loading...' : 'Login with Claude Account'}
								</Button>
							) : (
								<Button
									onClick={logoutOAuth}
									disabled={isOAuthLoading}
									className="font-normal"
									variant="secondary"
								>
									<LogOut className="w-4 h-4 mr-2" />
									{isOAuthLoading ? 'Logging out...' : 'Logout'}
								</Button>
							)}

							{isOAuthLoading && <RefreshCw className="w-4 h-4 animate-spin text-[#ccc]" />}
						</div>

						<div className="text-sm text-[#999]">
							<p>
								This will open a browser window to authenticate with your Claude account.
								Once authenticated, you can use your Claude subscription for AI operations.
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Help Section */}
			<Card className="bg-[#1a1a1a] border-[#333333]">
				<CardHeader>
					<CardTitle className="text-[#ffffff]">Setup Instructions</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div>
						<h4 className="font-semibold text-[#ffffff]">Claude Code CLI Provider (Recommended)</h4>
						<p className="text-sm text-[#ccc] mt-1">
							Automatically uses your existing Claude Code CLI authentication. Install Claude Code CLI with <code className="bg-[#222] px-1 py-0.5 rounded text-[#ccc]">npm install -g @anthropic-ai/claude-code</code> and authenticate with <code className="bg-[#222] px-1 py-0.5 rounded text-[#ccc]">claude auth</code>.
							This is the easiest and most reliable option.
						</p>
					</div>
					<div>
						<h4 className="font-semibold text-[#ffffff]">API Key Provider</h4>
						<p className="text-sm text-[#ccc] mt-1">
							Set <code className="bg-[#222] px-1 py-0.5 rounded text-[#ccc]">OPENAI_API_KEY</code> and/or <code className="bg-[#222] px-1 py-0.5 rounded text-[#ccc]">ANTHROPIC_API_KEY</code> in your environment.
							This uses direct API billing.
						</p>
					</div>
					<div>
						<h4 className="font-semibold text-[#ffffff]">Claude Session Provider</h4>
						<p className="text-sm text-[#ccc] mt-1">
							Make sure Claude Code is running and you're logged in. This uses your Claude subscription
							instead of per-token billing. Set <code className="bg-[#222] px-1 py-0.5 rounded text-[#ccc]">AUTH_PROVIDER=claude-session</code> in your .env file.
						</p>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

export default AuthSettings;