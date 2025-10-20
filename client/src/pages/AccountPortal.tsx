import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useAuth, useLogout } from '../hooks/useAuth';
import {
	useSavedBusinesses,
	useUpdateSavedBusiness,
	useDeleteSavedBusiness,
	useImportFromSearch,
	useImportFromCSV,
	useClearAllSavedBusinesses,
	SavedBusiness,
} from '../hooks/useSavedBusinesses';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Table,
	TableHeader,
	TableRow,
	TableHead,
	TableBody,
	TableCell,
} from '@/components/ui/table';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { downloadCSV, exportToCSV } from '../lib/utils';
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
	Loader2,
	FileUp,
	Download,
	AlertCircle,
	Trash2,
	Key,
	Settings,
} from 'lucide-react';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import ApiKeySetup from '@/components/ApiKeySetup';
import { useApiKeys } from '@/hooks/useApiKeys';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

export default function AccountPortal() {
	const { user, isLoading: isAuthLoading, isAuthenticated } = useAuth();
	const [currentPage, setCurrentPage] = useState(1);
	const [pageSize] = useState(50);
	const [searchTerm, setSearchTerm] = useState('');
	const [filterRecentOnly, setFilterRecentOnly] = useState(false);

	// Reset page when search term or filter changes
	useEffect(() => {
		setCurrentPage(1);
	}, [searchTerm, filterRecentOnly]);
	const {
		data: savedBusinessesData,
		isLoading: isBusinessesLoading,
		error,
	} = useSavedBusinesses(currentPage, pageSize, searchTerm, filterRecentOnly);
	const { data: apiKeysStatus } = useApiKeys();
	const updateBusinessMutation = useUpdateSavedBusiness();
	const deleteBusinessMutation = useDeleteSavedBusiness();
	const importFromSearchMutation = useImportFromSearch();
	const importFromCSVMutation = useImportFromCSV();
	const clearAllBusinessesMutation = useClearAllSavedBusinesses();
	const logout = useLogout();
	const [, setLocation] = useLocation();
	const { toast } = useToast();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [columbusCoords, setColumbusCoords] = useState<{
		lat: number;
		lng: number;
	} | null>(null);
	const [businessCoords, setBusinessCoords] = useState<
		Map<string, { lat: number; lng: number }>
	>(new Map());
	const [geocodingInProgress, setGeocodingInProgress] = useState<Set<string>>(
		new Set()
	);
	const [sortField, setSortField] = useState<keyof SavedBusiness>('name');
	const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [csvContent, setCsvContent] = useState<string>('');
	const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true);
	const [replaceDuplicates, setReplaceDuplicates] = useState<boolean>(false);
	const [csvPreviewData, setCsvPreviewData] = useState<SavedBusiness[]>([]);
	const [duplicatesFound, setDuplicatesFound] = useState<SavedBusiness[]>([]);
	const [existingDuplicates, setExistingDuplicates] = useState<
		SavedBusiness[]
	>([]);
	const [showDuplicatesDialog, setShowDuplicatesDialog] =
		useState<boolean>(false);
	const [cleanupResults, setCleanupResults] = useState<{
		fixed: number;
		issues: string[];
	}>({ fixed: 0, issues: [] });
	const [showCleanupDialog, setShowCleanupDialog] = useState<boolean>(false);
	const [selectedBusinesses, setSelectedBusinesses] = useState<Set<string>>(
		new Set()
	);
	const [isSelectAllChecked, setIsSelectAllChecked] =
		useState<boolean>(false);

	useEffect(() => {
		// Redirect to home if not authenticated
		if (!isAuthLoading && !isAuthenticated) {
			setLocation('/');
		}
	}, [isAuthLoading, isAuthenticated, setLocation]);

	const savedBusinesses = savedBusinessesData?.businesses || [];
	const totalBusinesses = savedBusinessesData?.total || 0;
	const totalPages = savedBusinessesData?.totalPages || 0;

	// Update select all checkbox state when individual selections change
	useEffect(() => {
		const allIds = savedBusinesses
			.map((b: SavedBusiness) => b._id)
			.filter(Boolean) as string[];
		const allSelected =
			allIds.length > 0 &&
			allIds.every((id) => selectedBusinesses.has(id));
		setIsSelectAllChecked(allSelected);
	}, [selectedBusinesses, savedBusinesses]);

	const getColumbusCoordinates = async () => {
		try {
			const response = await fetch(`/api/geocode?address=Columbus,OH`);
			if (response.ok) {
				const data = await response.json();
				setColumbusCoords(data.coordinates);
			}
		} catch (error) {
			console.error('Failed to get Columbus coordinates:', error);
		}
	};

	// Calculate distance between two coordinates using Haversine formula
	const calculateDistance = (
		lat1: number,
		lon1: number,
		lat2: number,
		lon2: number
	): number => {
		const R = 3958.8; // Earth's radius in miles
		const dLat = (lat2 - lat1) * (Math.PI / 180);
		const dLon = (lon2 - lon1) * (Math.PI / 180);
		const a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos(lat1 * (Math.PI / 180)) *
				Math.cos(lat2 * (Math.PI / 180)) *
				Math.sin(dLon / 2) *
				Math.sin(dLon / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		return R * c;
	};

	// Get coordinates from address using backend geocoding
	const getCoordinatesFromAddress = async (
		address: string
	): Promise<{ lat: number; lng: number } | null> => {
		try {
			const response = await fetch(
				`/api/geocode?address=${encodeURIComponent(address)}`
			);
			if (response.ok) {
				const data = await response.json();
				return data.coordinates;
			}
		} catch (error) {
			console.error('Failed to geocode address:', error);
		}
		return null;
	};

	// Geocode a business address and cache the result
	const geocodeBusiness = async (business: SavedBusiness) => {
		if (!business.location || !business._id) return null;

		// Check if we already have coordinates for this business
		if (businessCoords.has(business._id)) {
			return businessCoords.get(business._id)!;
		}

		// Check if geocoding is already in progress for this business
		if (geocodingInProgress.has(business._id)) {
			return null;
		}

		// Start geocoding
		setGeocodingInProgress((prev) => new Set(prev).add(business._id!));

		try {
			const coords = await getCoordinatesFromAddress(business.location);
			if (coords) {
				setBusinessCoords((prev) =>
					new Map(prev).set(business._id!, coords)
				);
				return coords;
			}
		} catch (error) {
			console.error(
				`Failed to geocode business ${business.name}:`,
				error
			);
		} finally {
			setGeocodingInProgress((prev) => {
				const newSet = new Set(prev);
				newSet.delete(business._id!);
				return newSet;
			});
		}

		return null;
	};

	// Helper function to check if a business was added recently (last 24 hours)
	const isRecentlyAdded = (business: SavedBusiness) => {
		if (!business.createdAt) return false;

		const createdDate = new Date(business.createdAt);
		const now = new Date();
		const diffTime = Math.abs(now.getTime() - createdDate.getTime());
		const diffHours = diffTime / (1000 * 60 * 60);

		return diffHours <= 24;
	};

	// No client-side filtering needed anymore - server handles filtering and sorting
	const filteredBusinesses = savedBusinesses;

	const handleSort = (field: keyof SavedBusiness) => {
		if (sortField === field) {
			setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
		} else {
			setSortField(field);
			setSortDirection('asc');
		}
	};

	// Bulk selection functions
	const handleSelectBusiness = (businessId: string) => {
		setSelectedBusinesses((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(businessId)) {
				newSet.delete(businessId);
			} else {
				newSet.add(businessId);
			}
			return newSet;
		});
	};

	const handleSelectAll = () => {
		if (isSelectAllChecked) {
			setSelectedBusinesses(new Set());
			setIsSelectAllChecked(false);
		} else {
			const allIds = savedBusinesses
				.map((b: SavedBusiness) => b._id)
				.filter(Boolean) as string[];
			setSelectedBusinesses(new Set(allIds));
			setIsSelectAllChecked(true);
		}
	};

	const handleBulkDelete = async () => {
		if (selectedBusinesses.size === 0) return;

		try {
			// Delete each selected business
			const deletePromises = Array.from(selectedBusinesses).map(
				(businessId) => deleteBusinessMutation.mutateAsync(businessId)
			);
			await Promise.all(deletePromises);

			toast({
				title: 'Bulk Delete Successful',
				description: `Deleted ${selectedBusinesses.size} companies successfully.`,
			});

			// Clear selection
			setSelectedBusinesses(new Set());
			setIsSelectAllChecked(false);
		} catch (error) {
			toast({
				title: 'Bulk Delete Failed',
				description:
					'Failed to delete some companies. Please try again.',
				variant: 'destructive',
			});
		}
	};

	const exportCSV = () => {
		if (filteredBusinesses.length > 0) {
			const csvContent = exportToCSV(
				filteredBusinesses.map((b: SavedBusiness) => ({
					id: b._id,
					name: b.name,
					website: b.website || '',
					location: b.location || '',
					distance: '',
					isBadLead: b.isBadLead,
					notes: b.notes || '',
					careerLink: b.careerLink || '',
				}))
			);

			downloadCSV(csvContent, 'master_business_list.csv');
		}
	};

	const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file && file.type === 'text/csv') {
			setSelectedFile(file);
			const reader = new FileReader();
			reader.onload = (e) => {
				const content = e.target?.result as string;
				setCsvContent(content);
			};
			reader.readAsText(file);
		} else {
			toast({
				title: 'Invalid File',
				description: 'Please select a valid CSV file.',
				variant: 'destructive',
			});
		}
	};

	const handleImportCSV = async () => {
		if (!csvContent) {
			toast({
				title: 'No File Selected',
				description: 'Please select a CSV file to import.',
				variant: 'destructive',
			});
			return;
		}

		try {
			await importFromCSVMutation.mutateAsync({
				csvData: csvContent,
				skipDuplicates,
				replaceDuplicates,
			});

			toast({
				title: 'Import Successful',
				description: 'Your CSV file has been imported successfully.',
			});

			// Reset form
			setSelectedFile(null);
			setCsvContent('');
			if (fileInputRef.current) {
				fileInputRef.current.value = '';
			}
		} catch (error) {
			toast({
				title: 'Import Failed',
				description:
					'Failed to import CSV file. Please check the format and try again.',
				variant: 'destructive',
			});
		}
	};

	if (isAuthLoading) {
		return (
			<div className='flex items-center justify-center min-h-screen'>
				<Loader2 className='w-8 h-8 animate-spin' />
			</div>
		);
	}

	if (!isAuthenticated) {
		return null; // Will redirect to home
	}

	return (
		<div className='container mx-auto p-4 max-w-7xl'>
			<Card className='mb-6'>
				<CardHeader>
					<div className='flex justify-between items-center'>
						<div>
							<CardTitle className='text-2xl font-bold'>
								Account Portal
							</CardTitle>
							<CardDescription>
								Manage your saved companies and API settings
							</CardDescription>
						</div>
						<div className='flex gap-2'>
							<Dialog>
								<DialogTrigger asChild>
									<Button variant='outline'>
										<Key className='w-4 h-4 mr-2' />
										API Settings
									</Button>
								</DialogTrigger>
								<DialogContent className='max-w-4xl max-h-[90vh] overflow-y-auto'>
									<DialogHeader>
										<DialogTitle>
											API Key Management
										</DialogTitle>
										<DialogDescription>
											Configure your Google Places and
											OpenAI API keys for full
											functionality
										</DialogDescription>
									</DialogHeader>
									<ApiKeySetup />
								</DialogContent>
							</Dialog>
							<Button variant='outline' onClick={logout}>
								Log Out
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<div className='flex flex-col sm:flex-row gap-4 mb-6'>
						<div className='flex-1'>
							<p>
								<strong>Email:</strong> {(user as any)?.email}
							</p>
						</div>
						<div className='flex gap-4 text-sm'>
							<div className='flex items-center gap-2'>
								<span>Google API:</span>
								{apiKeysStatus?.hasGooglePlacesKey ? (
									<Badge variant='default'>Configured</Badge>
								) : (
									<Badge variant='destructive'>Not Set</Badge>
								)}
							</div>
							<div className='flex items-center gap-2'>
								<span>OpenAI API:</span>
								{apiKeysStatus?.hasOpenaiKey ? (
									<Badge variant='default'>Configured</Badge>
								) : (
									<Badge variant='destructive'>Not Set</Badge>
								)}
							</div>
							<div className='flex items-center gap-2'>
								<span>MongoDB Atlas:</span>
								{apiKeysStatus?.hasMongodbUri ? (
									<Badge variant='default'>Configured</Badge>
								) : (
									<Badge variant='destructive'>Not Set</Badge>
								)}
							</div>
						</div>
					</div>
				</CardContent>
			</Card>
			{/* Company List */}
			<Card>
				<CardHeader>
					<CardTitle>My Company List</CardTitle>
					<CardDescription>
						Total: {filteredBusinesses.length} companies
						{savedBusinesses &&
							` (${savedBusinesses.length} total)`}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className='mb-4 flex flex-col sm:flex-row gap-4'>
						<div className='flex-1'>
							<Input
								placeholder='Search companies...'
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className='w-full'
							/>
						</div>
						<div className='flex items-center gap-4'>
							<div className='flex items-center gap-2'>
								<Checkbox
									id='filter-recent-only'
									checked={filterRecentOnly}
									onCheckedChange={(checked) =>
										setFilterRecentOnly(checked === true)
									}
								/>
								<Label htmlFor='filter-recent-only'>
									Show Recent Only (24h)
								</Label>
							</div>
						</div>
					</div>

					{isBusinessesLoading ? (
						<div className='flex items-center justify-center p-8'>
							<Loader2 className='w-8 h-8 animate-spin mr-2' />
							Loading companies...
						</div>
					) : error ? (
						<div className='text-center p-8'>
							<p className='text-red-600 mb-4'>
								Error loading companies: {error.message}
							</p>
							<Button onClick={() => window.location.reload()}>
								Retry
							</Button>
						</div>
					) : filteredBusinesses.length === 0 ? (
						<div className='text-center p-8'>
							<p className='text-muted-foreground mb-4'>
								{savedBusinesses?.length === 0
									? 'No companies in your list yet. Import some companies to get started.'
									: 'No companies match your current filters.'}
							</p>
						</div>
					) : (
						<div className='space-y-4'>
							<div className='flex justify-between items-center'>
								<div className='flex gap-2'>
									<Button
										variant='outline'
										size='sm'
										onClick={exportCSV}>
										<Download className='w-4 h-4 mr-2' />
										Export CSV
									</Button>

									<Dialog>
										<DialogTrigger asChild>
											<Button variant='outline' size='sm'>
												<FileUp className='w-4 h-4 mr-2' />
												Import CSV
											</Button>
										</DialogTrigger>
										<DialogContent className='max-w-md'>
											<DialogHeader>
												<DialogTitle>
													Import Companies from CSV
												</DialogTitle>
												<DialogDescription>
													Upload a CSV file to add
													companies to your saved
													list. Missing companies from
													old exports can be restored
													this way.
												</DialogDescription>
											</DialogHeader>

											<div className='space-y-4'>
												<div>
													<Label htmlFor='csv-file'>
														Select CSV File
													</Label>
													<Input
														id='csv-file'
														type='file'
														accept='.csv'
														ref={fileInputRef}
														onChange={
															handleFileSelect
														}
														className='mt-1'
													/>
													{selectedFile && (
														<p className='text-sm text-muted-foreground mt-1'>
															Selected:{' '}
															{selectedFile.name}
														</p>
													)}
												</div>

												<div className='space-y-2'>
													<div className='flex items-center space-x-2'>
														<Checkbox
															id='skip-duplicates'
															checked={
																skipDuplicates
															}
															onCheckedChange={(
																checked
															) =>
																setSkipDuplicates(
																	checked ===
																		true
																)
															}
														/>
														<Label htmlFor='skip-duplicates'>
															Skip duplicates
														</Label>
													</div>
													<div className='flex items-center space-x-2'>
														<Checkbox
															id='replace-duplicates'
															checked={
																replaceDuplicates
															}
															onCheckedChange={(
																checked
															) =>
																setReplaceDuplicates(
																	checked ===
																		true
																)
															}
														/>
														<Label htmlFor='replace-duplicates'>
															Replace duplicates
														</Label>
													</div>
												</div>

												<div className='flex gap-2 pt-4'>
													<Button
														onClick={
															handleImportCSV
														}
														disabled={
															!selectedFile ||
															importFromCSVMutation.isPending
														}
														className='flex-1'>
														{importFromCSVMutation.isPending ? (
															<>
																<Loader2 className='w-4 h-4 mr-2 animate-spin' />
																Importing...
															</>
														) : (
															<>
																<FileUp className='w-4 h-4 mr-2' />
																Import CSV
															</>
														)}
													</Button>
												</div>

												<div className='text-xs text-muted-foreground'>
													<p>
														<strong>
															Expected CSV format:
														</strong>
													</p>
													<p>
														name, website, location,
														notes
													</p>
													<p>
														Company A,
														company-a.com, City
														State, Optional notes
													</p>
												</div>
											</div>
										</DialogContent>
									</Dialog>

									<Button
										variant='outline'
										size='sm'
										onClick={() => {
											// Simple page reload to force complete refresh
											toast({
												title: 'Refreshing...',
												description:
													'Reloading page to fetch fresh data',
											});

											// Force complete page reload after short delay to show toast
											setTimeout(() => {
												window.location.reload();
											}, 500);
										}}>
										<svg
											className='w-4 h-4 mr-2'
											xmlns='http://www.w3.org/2000/svg'
											viewBox='0 0 24 24'
											fill='none'
											stroke='currentColor'
											strokeWidth='2'
											strokeLinecap='round'
											strokeLinejoin='round'>
											<path d='M23 4v6h-6'></path>
											<path d='M20.49 15a9 9 0 1 1-2.12-9.36L23 10'></path>
										</svg>
										Refresh from Database
									</Button>

									<AlertDialog>
										<AlertDialogTrigger asChild>
											<Button variant='outline' size='sm'>
												<AlertCircle className='w-4 h-4 mr-2' />
												Cleanup Duplicates
											</Button>
										</AlertDialogTrigger>
										<AlertDialogContent>
											<AlertDialogHeader>
												<AlertDialogTitle>
													Cleanup Duplicate Businesses
												</AlertDialogTitle>
												<AlertDialogDescription>
													This will scan all your
													saved businesses and remove
													duplicates based on company
													name and website. The older
													entry will be kept. This
													action cannot be undone.
												</AlertDialogDescription>
											</AlertDialogHeader>
											<AlertDialogFooter>
												<AlertDialogCancel>
													Cancel
												</AlertDialogCancel>
												<Button
													variant='destructive'
													onClick={async () => {
														try {
															const response =
																await fetch(
																	'/api/my/businesses/cleanup-duplicates',
																	{
																		method: 'POST',
																		headers:
																			{
																				'Content-Type':
																					'application/json',
																			},
																	}
																);

															if (response.ok) {
																const result =
																	await response.json();
																toast({
																	title: 'Cleanup Complete',
																	description: `Removed ${result.removed} duplicate businesses.`,
																});

																// Refresh the data
																queryClient.invalidateQueries(
																	[
																		'/api/my/businesses',
																	]
																);
															} else {
																throw new Error(
																	'Cleanup failed'
																);
															}
														} catch (error) {
															toast({
																title: 'Cleanup Failed',
																description:
																	'Failed to cleanup duplicates. Please try again.',
																variant:
																	'destructive',
															});
														}
													}}>
													Cleanup Duplicates
												</Button>
											</AlertDialogFooter>
										</AlertDialogContent>
									</AlertDialog>
								</div>

								<div className='text-sm text-muted-foreground'>
									Showing {filteredBusinesses.length} of{' '}
									{totalBusinesses} companies (Page{' '}
									{currentPage} of {totalPages})
								</div>
							</div>

							{/* Bulk Actions */}
							{selectedBusinesses.size > 0 && (
								<div className='flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4'>
									<div className='flex items-center gap-4'>
										<span className='text-sm font-medium text-blue-900'>
											{selectedBusinesses.size} item
											{selectedBusinesses.size !== 1
												? 's'
												: ''}{' '}
											selected
										</span>
									</div>
									<div className='flex items-center gap-2'>
										<AlertDialog>
											<AlertDialogTrigger asChild>
												<Button
													variant='destructive'
													size='sm'
													disabled={
														deleteBusinessMutation.isPending
													}>
													<Trash2 className='w-4 h-4 mr-2' />
													Delete Selected
												</Button>
											</AlertDialogTrigger>
											<AlertDialogContent>
												<AlertDialogHeader>
													<AlertDialogTitle>
														Delete Selected
														Companies
													</AlertDialogTitle>
													<AlertDialogDescription>
														Are you sure you want to
														delete{' '}
														{
															selectedBusinesses.size
														}{' '}
														selected companies? This
														action cannot be undone.
													</AlertDialogDescription>
												</AlertDialogHeader>
												<AlertDialogFooter>
													<AlertDialogCancel>
														Cancel
													</AlertDialogCancel>
													<Button
														variant='destructive'
														onClick={
															handleBulkDelete
														}
														disabled={
															deleteBusinessMutation.isPending
														}>
														{deleteBusinessMutation.isPending ? (
															<>
																<Loader2 className='w-4 h-4 mr-2 animate-spin' />
																Deleting...
															</>
														) : (
															'Delete'
														)}
													</Button>
												</AlertDialogFooter>
											</AlertDialogContent>
										</AlertDialog>
									</div>
								</div>
							)}

							{/* Pagination Controls - Top */}
							{totalPages > 1 && (
								<div className='flex items-center justify-between px-2 py-2'>
									<div className='flex items-center space-x-6 lg:space-x-8'>
										<div className='flex items-center space-x-2'>
											<p className='text-sm font-medium'>
												Page {currentPage} of{' '}
												{totalPages}
											</p>
										</div>
									</div>
									<div className='flex items-center space-x-2'>
										<Button
											variant='outline'
											size='sm'
											onClick={() =>
												setCurrentPage(currentPage - 1)
											}
											disabled={currentPage <= 1}>
											Previous
										</Button>
										<Button
											variant='outline'
											size='sm'
											onClick={() =>
												setCurrentPage(currentPage + 1)
											}
											disabled={
												currentPage >= totalPages
											}>
											Next
										</Button>
									</div>
								</div>
							)}

							<div className='border rounded-lg overflow-hidden'>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className='w-[50px]'>
												<Checkbox
													checked={isSelectAllChecked}
													onCheckedChange={
														handleSelectAll
													}
												/>
											</TableHead>
											<TableHead
												className='cursor-pointer'
												onClick={() =>
													handleSort('name')
												}>
												Company Name{' '}
												{sortField === 'name' &&
													(sortDirection === 'asc'
														? '↑'
														: '↓')}
											</TableHead>
											<TableHead
												className='cursor-pointer'
												onClick={() =>
													handleSort('website')
												}>
												Website{' '}
												{sortField === 'website' &&
													(sortDirection === 'asc'
														? '↑'
														: '↓')}
											</TableHead>
											<TableHead
												className='cursor-pointer'
												onClick={() =>
													handleSort('location')
												}>
												Location{' '}
												{sortField === 'location' &&
													(sortDirection === 'asc'
														? '↑'
														: '↓')}
											</TableHead>
											<TableHead
												className='cursor-pointer'
												onClick={() =>
													handleSort('createdAt')
												}>
												Date Added{' '}
												{sortField === 'createdAt' &&
													(sortDirection === 'asc'
														? '↑'
														: '↓')}
											</TableHead>
											<TableHead>Notes</TableHead>
											<TableHead className='w-[100px] text-right'>
												Actions
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{filteredBusinesses.map(
											(business: SavedBusiness) => (
												<TableRow key={business._id}>
													<TableCell>
														<Checkbox
															checked={selectedBusinesses.has(
																business._id ||
																	''
															)}
															onCheckedChange={() =>
																handleSelectBusiness(
																	business._id ||
																		''
																)
															}
														/>
													</TableCell>
													<TableCell className='font-medium'>
														<div className='flex items-center gap-2'>
															{business.name}
															{isRecentlyAdded(
																business as SavedBusiness
															) && (
																<span className='inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700'>
																	New
																</span>
															)}
														</div>
													</TableCell>
													<TableCell>
														{business.website ? (
															<a
																href={
																	business.website.startsWith(
																		'http'
																	)
																		? business.website
																		: `https://${business.website}`
																}
																target='_blank'
																rel='noopener noreferrer'
																className='text-blue-600 hover:underline'>
																{
																	business.website
																}
															</a>
														) : (
															<span className='text-muted-foreground'>
																No website
															</span>
														)}
													</TableCell>
													<TableCell>
														{business.location ||
															'N/A'}
													</TableCell>
													<TableCell>
														{business.createdAt
															? new Date(
																	business.createdAt
															  ).toLocaleDateString()
															: 'N/A'}
													</TableCell>
													<TableCell>
														{business.notes || ''}
													</TableCell>
													<TableCell className='text-right'>
														<Button
															variant='outline'
															size='sm'
															onClick={() => {
																if (
																	business._id
																) {
																	deleteBusinessMutation.mutate(
																		business._id
																	);
																}
															}}>
															<Trash2 className='w-4 h-4' />
														</Button>
													</TableCell>
												</TableRow>
											)
										)}
									</TableBody>
								</Table>
							</div>

							{/* Pagination Controls */}
							{totalPages > 1 && (
								<div className='flex items-center justify-between px-2'>
									<div className='flex items-center space-x-6 lg:space-x-8'>
										<div className='flex items-center space-x-2'>
											<p className='text-sm font-medium'>
												Page {currentPage} of{' '}
												{totalPages}
											</p>
										</div>
									</div>
									<div className='flex items-center space-x-2'>
										<Button
											variant='outline'
											size='sm'
											onClick={() =>
												setCurrentPage(currentPage - 1)
											}
											disabled={currentPage <= 1}>
											Previous
										</Button>
										<Button
											variant='outline'
											size='sm'
											onClick={() =>
												setCurrentPage(currentPage + 1)
											}
											disabled={
												currentPage >= totalPages
											}>
											Next
										</Button>
									</div>
								</div>
							)}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
