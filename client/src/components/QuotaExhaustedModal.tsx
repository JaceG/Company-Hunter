import { useState } from 'react';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useRegister } from '@/hooks/useAuth';
import { Loader2, SearchX, Sparkles, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

interface QuotaExhaustedModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export default function QuotaExhaustedModal({
	isOpen,
	onClose,
}: QuotaExhaustedModalProps) {
	const { toast } = useToast();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [name, setName] = useState('');

	const registerMutation = useRegister();

	const handleRegister = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			await registerMutation.mutateAsync({ email, password, name });

			toast({
				title: 'Account Created Successfully!',
				description:
					'Welcome! Your guest data has been transferred to your account. Set up your API keys to continue searching.',
			});

			// Invalidate API keys query to refresh status for new user
			queryClient.invalidateQueries({ queryKey: ['/api/auth/api-keys'] });

			// Invalidate saved businesses to show migrated data
			queryClient.invalidateQueries({ queryKey: ['/api/my/businesses'] });

			// Clear form
			setEmail('');
			setPassword('');
			setName('');
			onClose();
		} catch (error) {
			console.error('Registration failed:', error);
			toast({
				title: 'Registration Failed',
				description:
					error instanceof Error
						? error.message
						: 'Failed to create account. Please try again.',
				variant: 'destructive',
			});
		}
	};

	const benefits = [
		'Unlimited business searches',
		'Save and organize companies',
		'Export to CSV/Excel',
		'Advanced filtering options',
		'State-wide search capabilities',
		'AI-powered search suggestions',
	];

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className='sm:max-w-md'>
				<DialogHeader>
					<DialogTitle className='flex items-center gap-2'>
						<SearchX className='h-5 w-5 text-orange-500' />
						Demo Quota Exhausted
					</DialogTitle>
					<DialogDescription>
						You've used all 20 demo searches! Create a free account
						to continue searching with unlimited access.
					</DialogDescription>
				</DialogHeader>

				<div className='space-y-4'>
					{/* Benefits List */}
					<div className='bg-blue-50 rounded-lg p-4'>
						<div className='flex items-center gap-2 mb-3'>
							<Sparkles className='h-4 w-4 text-blue-600' />
							<span className='font-medium text-blue-900'>
								What you'll get:
							</span>
						</div>
						<div className='grid grid-cols-1 gap-2'>
							{benefits.map((benefit, index) => (
								<div
									key={index}
									className='flex items-center gap-2 text-sm text-blue-800'>
									<Check className='h-3 w-3 text-blue-600' />
									<span>{benefit}</span>
								</div>
							))}
						</div>
					</div>

					{/* Registration Form */}
					<form onSubmit={handleRegister} className='space-y-4'>
						<div className='space-y-2'>
							<Label htmlFor='quota-register-name'>
								Name (Optional)
							</Label>
							<Input
								id='quota-register-name'
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder='Your name'
							/>
						</div>
						<div className='space-y-2'>
							<Label htmlFor='quota-register-email'>Email</Label>
							<Input
								id='quota-register-email'
								type='email'
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								placeholder='your@email.com'
							/>
						</div>
						<div className='space-y-2'>
							<Label htmlFor='quota-register-password'>
								Password
							</Label>
							<Input
								id='quota-register-password'
								type='password'
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								minLength={6}
								placeholder='At least 6 characters'
							/>
						</div>

						<DialogFooter className='flex-col sm:flex-row gap-2'>
							<Button
								variant='outline'
								onClick={onClose}
								disabled={registerMutation.isPending}>
								Maybe Later
							</Button>
							<Button
								type='submit'
								disabled={registerMutation.isPending}
								className='w-full sm:w-auto bg-blue-600 hover:bg-blue-700'>
								{registerMutation.isPending ? (
									<>
										<Loader2 className='mr-2 h-4 w-4 animate-spin' />
										Creating Account...
									</>
								) : (
									'Create Free Account'
								)}
							</Button>
						</DialogFooter>
					</form>
				</div>
			</DialogContent>
		</Dialog>
	);
}
