import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SearchParams } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useStateSearch, useStateCities } from '@/hooks/useStateSearch';
import { useApiKeys } from '@/hooks/useApiKeys';
import { MapPin, Key, Sparkles, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface SearchPanelProps {
	onSearch: (params: SearchParams) => void;
	isLoading: boolean;
}

interface StateSearchParams {
	businessType: string;
	state: string;
	maxCities: number;
}

export default function SearchPanel({ onSearch, isLoading }: SearchPanelProps) {
	const { toast } = useToast();
	const [searchParams, setSearchParams] = useState<SearchParams>({
		businessType: '',
		location: 'Columbus, OH',
	});

	const [stateParams, setStateParams] = useState<StateSearchParams>({
		businessType: '',
		state: 'Ohio',
		maxCities: 5,
	});

	const [jobRole, setJobRole] = useState('');

	const [suggestions, setSuggestions] = useState<string[]>([]);
	const [availableCities, setAvailableCities] = useState<string[]>([]);
	const [selectedCities, setSelectedCities] = useState<string[]>([]);
	const [showSuggestions, setShowSuggestions] = useState(false);
	const [showCities, setShowCities] = useState(false);
	const [loadingSuggestions, setLoadingSuggestions] = useState(false);
	const [loadingCities, setLoadingCities] = useState(false);
	const [sortBy, setSortBy] = useState<'size' | 'alphabetical'>('size');

	const { data: apiKeysStatus } = useApiKeys();
	const stateSearch = useStateSearch();
	const stateCities = useStateCities();

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { id, value } = e.target;
		setSearchParams((prev) => ({ ...prev, [id]: value }));
	};

	const handleSelectChange = (value: string, name: string) => {
		setSearchParams((prev) => ({ ...prev, [name]: value }));
	};

	const handleStateInputChange = (
		field: keyof StateSearchParams,
		value: string | number
	) => {
		setStateParams((prev) => ({ ...prev, [field]: value }));
	};

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		if (!searchParams.businessType.trim()) {
			toast({
				title: 'Business type is required',
				description: 'Please enter a business type to search for',
				variant: 'destructive',
			});
			return;
		}

		if (!searchParams.location.trim()) {
			toast({
				title: 'Location is required',
				description: 'Please enter a location to search',
				variant: 'destructive',
			});
			return;
		}

		onSearch(searchParams);
	};

	const handleStateSearch = async () => {
		if (!stateParams.businessType.trim()) {
			toast({
				title: 'Business type is required',
				description: 'Please enter a business type to search for',
				variant: 'destructive',
			});
			return;
		}

		if (!apiKeysStatus?.hasGooglePlacesKey) {
			toast({
				title: 'Google API key required',
				description: 'Please set up your API keys first',
				variant: 'destructive',
			});
			return;
		}

		if (selectedCities.length === 0) {
			toast({
				title: 'Cities required',
				description: 'Please select at least one city to search',
				variant: 'destructive',
			});
			return;
		}

		try {
			const searchParams = {
				...stateParams,
				selectedCities,
				maxCities: selectedCities.length,
			};

			const result = await stateSearch.mutateAsync(searchParams);

			toast({
				title: 'Search completed',
				description: `Found ${result.total} businesses across ${selectedCities.length} selected cities`,
			});

			// Convert state search result to regular search format for display
			onSearch({
				businessType: stateParams.businessType,
				location: `${selectedCities.join(', ')} (${
					selectedCities.length
				} cities)`,
				radius: 'custom',
				maxResults: `${result.total} results (up to 20 per city)`,
			});
		} catch (error) {
			console.error('State search error:', error);
			toast({
				title: 'Search failed',
				description:
					'Failed to search selected cities. Please check your API keys and try again.',
				variant: 'destructive',
			});
		}
	};

	const handleGetSuggestions = async (targetJobRole?: string) => {
		const roleToUse = targetJobRole || jobRole;
		if (!roleToUse.trim()) {
			toast({
				title: 'Job role is required',
				description:
					'Please enter your job role to get search suggestions',
				variant: 'destructive',
			});
			return;
		}

		if (!apiKeysStatus?.hasOpenaiKey) {
			toast({
				title: 'OpenAI API key required',
				description:
					'Please set up your OpenAI API key for AI suggestions',
				variant: 'destructive',
			});
			return;
		}

		try {
			setLoadingSuggestions(true);
			const data = await apiRequest(
				'POST',
				'/api/businesses/suggestions',
				{
					jobRole: roleToUse,
				}
			);

			setSuggestions(data.suggestions || []);
			setShowSuggestions(true);

			toast({
				title: 'AI suggestions generated',
				description: `Generated ${
					data.suggestions?.length || 0
				} business search terms for ${roleToUse}`,
			});
		} catch (error) {
			console.error('Error getting suggestions:', error);
			toast({
				title: 'Failed to generate suggestions',
				description: 'Please check your OpenAI API key setup',
				variant: 'destructive',
			});
		} finally {
			setLoadingSuggestions(false);
		}
	};

	const getCitiesForState = async (state: string) => {
		if (!apiKeysStatus?.hasOpenaiKey) {
			toast({
				title: 'OpenAI API key required',
				description:
					'Please set up your OpenAI API key for city suggestions',
				variant: 'destructive',
			});
			return;
		}

		try {
			setLoadingCities(true);
			const result = await stateCities.mutateAsync({
				state,
				maxCities: 500,
				sortBy: sortBy,
			});
			setAvailableCities(result.cities || []);
			setSelectedCities([]);
			setShowCities(true);
			toast({
				title: 'Cities loaded',
				description: `Found ${
					result.count
				} cities in ${state}, sorted by ${
					sortBy === 'size' ? 'population size' : 'alphabetical order'
				}. Select up to 5 cities to search.`,
			});
		} catch (error) {
			console.error('Error getting cities:', error);
			toast({
				title: 'Failed to load cities',
				description: 'Please check your API key setup',
				variant: 'destructive',
			});
		} finally {
			setLoadingCities(false);
		}
	};

	const handleCityToggle = (city: string) => {
		setSelectedCities((prev) => {
			if (prev.includes(city)) {
				return prev.filter((c) => c !== city);
			} else if (prev.length < 5) {
				return [...prev, city];
			} else {
				toast({
					title: 'Maximum cities reached',
					description:
						'You can select up to 5 cities for optimal performance',
					variant: 'destructive',
				});
				return prev;
			}
		});
	};

	const US_STATES = [
		'Alabama',
		'Alaska',
		'Arizona',
		'Arkansas',
		'California',
		'Colorado',
		'Connecticut',
		'Delaware',
		'Florida',
		'Georgia',
		'Hawaii',
		'Idaho',
		'Illinois',
		'Indiana',
		'Iowa',
		'Kansas',
		'Kentucky',
		'Louisiana',
		'Maine',
		'Maryland',
		'Massachusetts',
		'Michigan',
		'Minnesota',
		'Mississippi',
		'Missouri',
		'Montana',
		'Nebraska',
		'Nevada',
		'New Hampshire',
		'New Jersey',
		'New Mexico',
		'New York',
		'North Carolina',
		'North Dakota',
		'Ohio',
		'Oklahoma',
		'Oregon',
		'Pennsylvania',
		'Rhode Island',
		'South Carolina',
		'South Dakota',
		'Tennessee',
		'Texas',
		'Utah',
		'Vermont',
		'Virginia',
		'Washington',
		'West Virginia',
		'Wisconsin',
		'Wyoming',
	];

	return (
		<Card className='w-full h-fit'>
			<CardHeader>
				<CardTitle className='flex items-center gap-2 text-lg'>
					<MapPin className='h-5 w-5' />
					Business Search
				</CardTitle>
			</CardHeader>
			<CardContent className='space-y-4'>
				{!apiKeysStatus?.hasGooglePlacesKey && (
					<Alert className='mb-4'>
						<Key className='h-4 w-4' />
						<AlertDescription className='text-sm break-words'>
							Google Places API key required for searching. Please
							set up your API keys in Account Portal.
						</AlertDescription>
					</Alert>
				)}

				<Tabs defaultValue='single' className='w-full'>
					<TabsList className='grid w-full grid-cols-2 text-xs'>
						<TabsTrigger value='single' className='text-xs'>
							Single Search
						</TabsTrigger>
						<TabsTrigger value='state' className='text-xs'>
							State Search
						</TabsTrigger>
					</TabsList>

					<TabsContent value='single' className='space-y-4'>
						<form onSubmit={handleSubmit} className='space-y-4'>
							<div className='space-y-2'>
								<Label htmlFor='jobRole'>AI Suggestions</Label>
								<Input
									id='jobRole'
									value={jobRole}
									onChange={(e) => setJobRole(e.target.value)}
									placeholder='e.g., software engineer, marketing manager'
								/>
								<Button
									type='button'
									variant='outline'
									onClick={() => handleGetSuggestions()}
									disabled={
										loadingSuggestions ||
										!jobRole.trim() ||
										!apiKeysStatus?.hasOpenaiKey
									}
									className='w-full'>
									<Sparkles className='w-4 h-4 mr-1' />
									{loadingSuggestions
										? 'Generating...'
										: 'Get AI Suggestions'}
								</Button>
							</div>

							<div className='space-y-2'>
								<Label htmlFor='businessType'>
									Business/Job Type
								</Label>
								<Input
									id='businessType'
									value={searchParams.businessType}
									onChange={handleInputChange}
									placeholder='e.g., software companies, marketing manager, dental offices'
								/>
								{showSuggestions && suggestions.length > 0 && (
									<div className='text-xs text-muted-foreground space-y-1'>
										<p>AI Suggestions (click to use):</p>
										<div className='flex flex-wrap gap-1'>
											{suggestions.map(
												(suggestion, index) => (
													<button
														key={index}
														type='button'
														onClick={() =>
															setSearchParams(
																(prev) => ({
																	...prev,
																	businessType:
																		suggestion,
																})
															)
														}
														className='bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs border border-blue-200'>
														{suggestion}
													</button>
												)
											)}
										</div>
									</div>
								)}
							</div>

							<div className='space-y-2'>
								<Label htmlFor='location'>Location</Label>
								<Input
									id='location'
									value={searchParams.location}
									onChange={handleInputChange}
									placeholder='e.g., Columbus, OH'
								/>
							</div>

							<Button
								type='submit'
								disabled={
									isLoading ||
									!apiKeysStatus?.hasGooglePlacesKey
								}
								className='w-full'>
								{isLoading
									? 'Searching...'
									: 'Search Businesses'}
							</Button>
						</form>
					</TabsContent>

					<TabsContent value='state' className='space-y-4'>
						<div className='space-y-4'>
							<div className='space-y-2'>
								<Label htmlFor='state-job-role'>
									AI Suggestions
								</Label>
								<Input
									id='state-job-role'
									value={jobRole}
									onChange={(e) => setJobRole(e.target.value)}
									placeholder='e.g., software engineer, marketing manager'
								/>
								<Button
									type='button'
									variant='outline'
									onClick={() => handleGetSuggestions()}
									disabled={
										loadingSuggestions ||
										!jobRole.trim() ||
										!apiKeysStatus?.hasOpenaiKey
									}
									className='w-full'>
									<Sparkles className='w-4 h-4 mr-1' />
									{loadingSuggestions
										? 'Generating...'
										: 'Get AI Suggestions'}
								</Button>
							</div>

							<div className='space-y-2'>
								<Label htmlFor='state-business-type'>
									Business/Job Type
								</Label>
								<Input
									id='state-business-type'
									value={stateParams.businessType}
									onChange={(e) =>
										handleStateInputChange(
											'businessType',
											e.target.value
										)
									}
									placeholder='e.g., software companies, marketing manager, dental offices'
								/>
								{showSuggestions && suggestions.length > 0 && (
									<div className='text-xs text-muted-foreground space-y-1'>
										<p>AI Suggestions (click to use):</p>
										<div className='flex flex-wrap gap-1'>
											{suggestions.map(
												(suggestion, index) => (
													<button
														key={index}
														type='button'
														onClick={() =>
															handleStateInputChange(
																'businessType',
																suggestion
															)
														}
														className='bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs border border-blue-200'>
														{suggestion}
													</button>
												)
											)}
										</div>
									</div>
								)}
							</div>

							<div className='space-y-2'>
								<Label htmlFor='state'>State</Label>
								<Select
									value={stateParams.state}
									onValueChange={(value) =>
										handleStateInputChange('state', value)
									}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{US_STATES.map((state) => (
											<SelectItem
												key={state}
												value={state}>
												{state}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className='space-y-3'>
								<div className='space-y-2'>
									<Label>City Sorting</Label>
									<div className='flex gap-2'>
										<Button
											type='button'
											variant={
												sortBy === 'size'
													? 'default'
													: 'outline'
											}
											onClick={() => {
												setSortBy('size');
												if (
													availableCities.length > 0
												) {
													getCitiesForState(
														stateParams.state
													);
												}
											}}
											className='flex-1'
											size='sm'
											disabled={loadingCities}>
											By Size
										</Button>
										<Button
											type='button'
											variant={
												sortBy === 'alphabetical'
													? 'default'
													: 'outline'
											}
											onClick={() => {
												setSortBy('alphabetical');
												if (
													availableCities.length > 0
												) {
													getCitiesForState(
														stateParams.state
													);
												}
											}}
											className='flex-1'
											size='sm'
											disabled={loadingCities}>
											A-Z
										</Button>
									</div>
								</div>

								<Button
									variant='outline'
									onClick={() =>
										getCitiesForState(stateParams.state)
									}
									disabled={
										loadingCities ||
										!apiKeysStatus?.hasOpenaiKey
									}
									className='w-full'>
									<Sparkles className='w-4 h-4 mr-2' />
									{loadingCities
										? 'Loading...'
										: `Get 500 Cities (${
												sortBy === 'size'
													? 'By Size'
													: 'A-Z'
										  }) for ${stateParams.state}`}
								</Button>
							</div>

							{showCities && availableCities.length > 0 && (
								<div className='space-y-2'>
									<div className='flex items-center justify-between'>
										<Label>
											Select Cities to Search (max 5)
										</Label>
										<span className='text-sm text-muted-foreground'>
											{selectedCities.length}/5 selected
										</span>
									</div>
									<div className='max-h-64 overflow-y-auto border rounded-md p-3 space-y-2'>
										{availableCities.map((city, index) => (
											<div
												key={`${city}-${index}`}
												className='flex items-center space-x-2'>
												<Checkbox
													id={`city-${city}-${index}`}
													checked={selectedCities.includes(
														city
													)}
													onCheckedChange={() =>
														handleCityToggle(city)
													}
													disabled={
														!selectedCities.includes(
															city
														) &&
														selectedCities.length >=
															5
													}
												/>
												<Label
													htmlFor={`city-${city}-${index}`}
													className={`text-sm cursor-pointer ${
														!selectedCities.includes(
															city
														) &&
														selectedCities.length >=
															5
															? 'text-muted-foreground'
															: ''
													}`}>
													{city}
												</Label>
											</div>
										))}
									</div>
								</div>
							)}

							{selectedCities.length > 0 && (
								<Alert>
									<AlertCircle className='h-4 w-4' />
									<AlertDescription>
										<strong>Ready to Search:</strong>{' '}
										{selectedCities.length} cities selected.
										Estimated cost: $
										{(
											selectedCities.length * 0.049
										).toFixed(2)}
										. Includes duplicate detection and
										export features.
									</AlertDescription>
								</Alert>
							)}

							<Button
								onClick={handleStateSearch}
								disabled={
									stateSearch.isPending ||
									!apiKeysStatus?.hasGooglePlacesKey ||
									selectedCities.length === 0
								}
								className='w-full'>
								{stateSearch.isPending
									? 'Searching...'
									: `Search ${selectedCities.length} Selected Cities`}
							</Button>
						</div>
					</TabsContent>
				</Tabs>
			</CardContent>
		</Card>
	);
}
