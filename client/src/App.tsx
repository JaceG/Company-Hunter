import { Switch, Route, Link } from 'wouter';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Home from '@/pages/Home';
import AccountPortal from './pages/AccountPortal';
import { useAuth, useLogin, useRegister, useLogout } from './hooks/useAuth';
import { useHotjar } from './hooks/useHotjar';
import { useState, useEffect } from 'react';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, User } from 'lucide-react';

function Router() {
	return (
		<Switch>
			<Route path='/' component={Home} />
			<Route path='/account' component={AccountPortal} />
			<Route path='/portal' component={AccountPortal} />
			<Route component={NotFound} />
		</Switch>
	);
}

function AuthButtons() {
	const { user, isLoading, isAuthenticated } = useAuth();
	const logout = useLogout();
	const [isLoginOpen, setIsLoginOpen] = useState(false);
	const [isRegisterOpen, setIsRegisterOpen] = useState(false);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [name, setName] = useState('');

	const loginMutation = useLogin();
	const registerMutation = useRegister();

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			await loginMutation.mutateAsync({ email, password });
			setIsLoginOpen(false);
			setEmail('');
			setPassword('');
		} catch (error) {
			console.error('Login failed:', error);
		}
	};

	const handleRegister = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			await registerMutation.mutateAsync({ email, password, name });
			setIsRegisterOpen(false);
			setEmail('');
			setPassword('');
			setName('');
		} catch (error) {
			console.error('Registration failed:', error);
		}
	};

	if (isLoading) {
		return (
			<Button variant='ghost' disabled>
				<Loader2 className='mr-2 h-4 w-4 animate-spin' />
				Loading...
			</Button>
		);
	}

	if (isAuthenticated) {
		return (
			<div className='flex items-center gap-2'>
				<Link href='/account'>
					<Button variant='ghost' className='flex items-center gap-2'>
						<User className='h-4 w-4' />
						My Account
					</Button>
				</Link>
				<Button variant='outline' onClick={logout}>
					Log Out
				</Button>
			</div>
		);
	}

	return (
		<div className='flex items-center gap-2'>
			<Dialog open={isLoginOpen} onOpenChange={setIsLoginOpen}>
				<DialogTrigger asChild>
					<Button variant='outline'>Log In</Button>
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Log In</DialogTitle>
						<DialogDescription>
							Log in to your account to access your saved
							companies.
						</DialogDescription>
					</DialogHeader>
					<form onSubmit={handleLogin} className='space-y-4 mt-4'>
						<div className='space-y-2'>
							<Label htmlFor='email'>Email</Label>
							<Input
								id='email'
								type='email'
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
							/>
						</div>
						<div className='space-y-2'>
							<Label htmlFor='password'>Password</Label>
							<Input
								id='password'
								type='password'
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
							/>
						</div>
						<DialogFooter>
							<Button
								type='submit'
								disabled={loginMutation.isPending}>
								{loginMutation.isPending ? (
									<>
										<Loader2 className='mr-2 h-4 w-4 animate-spin' />
										Logging in...
									</>
								) : (
									'Log In'
								)}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
				<DialogTrigger asChild>
					<Button>Register</Button>
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create Account</DialogTitle>
						<DialogDescription>
							Create an account to save and manage your companies.
						</DialogDescription>
					</DialogHeader>
					<form onSubmit={handleRegister} className='space-y-4 mt-4'>
						<div className='space-y-2'>
							<Label htmlFor='register-name'>
								Name (Optional)
							</Label>
							<Input
								id='register-name'
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
						</div>
						<div className='space-y-2'>
							<Label htmlFor='register-email'>Email</Label>
							<Input
								id='register-email'
								type='email'
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
							/>
						</div>
						<div className='space-y-2'>
							<Label htmlFor='register-password'>Password</Label>
							<Input
								id='register-password'
								type='password'
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								minLength={6}
							/>
						</div>
						<DialogFooter>
							<Button
								type='submit'
								disabled={registerMutation.isPending}>
								{registerMutation.isPending ? (
									<>
										<Loader2 className='mr-2 h-4 w-4 animate-spin' />
										Creating account...
									</>
								) : (
									'Create Account'
								)}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function Header() {
	return (
		<header className='bg-white shadow-sm'>
			<div className='container mx-auto px-4 py-3 flex justify-between items-center'>
				<Link href='/'>
					<h1 className='text-xl font-bold cursor-pointer'>
						Business Search Tool
					</h1>
				</Link>
				<AuthButtons />
			</div>
		</header>
	);
}

function App() {
	// Initialize Hotjar tracking for SPA route changes
	useHotjar();

	// Debug: Add test event trigger (remove after verification)
	const [hasTriggeredTest, setHasTriggeredTest] = useState(false);

	useEffect(() => {
		if (hasTriggeredTest) return;

		const triggerTestEvent = () => {
			if (typeof window !== 'undefined' && window.hj) {
				console.log('🔥 Hotjar: Triggering test event - app-loaded');
				window.hj('event', 'app-loaded');
				setHasTriggeredTest(true);
			} else {
				setTimeout(triggerTestEvent, 1000);
			}
		};

		setTimeout(triggerTestEvent, 2000); // Wait 2s then try
	}, [hasTriggeredTest]);

	return (
		<QueryClientProvider client={queryClient}>
			<TooltipProvider>
				<div className='min-h-screen bg-gray-50 flex flex-col'>
					<Header />
					<main className='flex-1'>
						<Router />
					</main>
					<Toaster />
				</div>
			</TooltipProvider>
		</QueryClientProvider>
	);
}

export default App;
