import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, Key, Info, CheckCircle, XCircle } from "lucide-react";
import { useApiKeys, useSaveApiKeys, useDeleteApiKeys } from "@/hooks/useApiKeys";
import { useToast } from "@/hooks/use-toast";

export default function ApiKeySetup() {
  const [googleKey, setGoogleKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [mongodbUri, setMongodbUri] = useState("");
  const [showKeys, setShowKeys] = useState(false);

  const { data: apiKeysStatus, isLoading } = useApiKeys();
  const saveApiKeys = useSaveApiKeys();
  const deleteApiKeys = useDeleteApiKeys();
  const { toast } = useToast();

  const handleSave = async () => {
    try {
      await saveApiKeys.mutateAsync({
        googlePlacesApiKey: googleKey || undefined,
        openaiApiKey: openaiKey || undefined,
        mongodbUri: mongodbUri || undefined,
      });
      
      toast({
        title: "Configuration Saved",
        description: "Your API keys and database configuration have been securely saved.",
      });
      
      setGoogleKey("");
      setOpenaiKey("");
      setMongodbUri("");
      setShowKeys(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save configuration. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteApiKeys.mutateAsync();
      toast({
        title: "API Keys Deleted",
        description: "Your API keys have been removed.",
      });
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to delete API keys.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <div>Loading API key status...</div>;
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          API Key Setup
        </CardTitle>
        <CardDescription>
          Configure your API keys for Google Places and OpenAI services to use all features.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="status" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="status">Current Status</TabsTrigger>
            <TabsTrigger value="setup">Setup Keys</TabsTrigger>
            <TabsTrigger value="instructions">Instructions</TabsTrigger>
          </TabsList>
          
          <TabsContent value="status" className="space-y-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <span className="font-medium">Google Places API:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  apiKeysStatus?.hasGooglePlacesKey 
                    ? "bg-blue-100 text-blue-700" 
                    : "bg-red-100 text-red-700"
                }`}>
                  {apiKeysStatus?.hasGooglePlacesKey ? "Configured" : "Not configured"}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="font-medium">OpenAI API:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  apiKeysStatus?.hasOpenaiKey 
                    ? "bg-blue-100 text-blue-700" 
                    : "bg-red-100 text-red-700"
                }`}>
                  {apiKeysStatus?.hasOpenaiKey ? "Configured" : "Not configured"}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="font-medium">MongoDB Atlas:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  apiKeysStatus?.hasMongodbUri 
                    ? "bg-blue-100 text-blue-700" 
                    : "bg-red-100 text-red-700"
                }`}>
                  {apiKeysStatus?.hasMongodbUri ? "Configured" : "Not configured"}
                </span>
              </div>
            </div>
            
            {(apiKeysStatus?.hasGooglePlacesKey || apiKeysStatus?.hasOpenaiKey) && (
              <div className="pt-4">
                <Button 
                  variant="destructive" 
                  onClick={handleDelete}
                  disabled={deleteApiKeys.isPending}
                >
                  Delete All API Keys
                </Button>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="setup" className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Your API keys are stored securely and only used for your searches. Click "Instructions" for setup help.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="google-key">Google Places API Key</Label>
                <Input
                  id="google-key"
                  type={showKeys ? "text" : "password"}
                  value={googleKey}
                  onChange={(e) => setGoogleKey(e.target.value)}
                  placeholder="Enter your Google Places API key"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="openai-key">OpenAI API Key</Label>
                <Input
                  id="openai-key"
                  type={showKeys ? "text" : "password"}
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="Enter your OpenAI API key"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="mongodb-uri">MongoDB Atlas URI</Label>
                <Input
                  id="mongodb-uri"
                  type={showKeys ? "text" : "password"}
                  value={mongodbUri}
                  onChange={(e) => setMongodbUri(e.target.value)}
                  placeholder="mongodb+srv://username:password@cluster.mongodb.net/database"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="show-keys"
                  checked={showKeys}
                  onChange={(e) => setShowKeys(e.target.checked)}
                />
                <Label htmlFor="show-keys" className="text-sm">Show API keys</Label>
              </div>
              
              <Button 
                onClick={handleSave}
                disabled={saveApiKeys.isPending || (!googleKey && !openaiKey && !mongodbUri)}
                className="w-full"
              >
                {saveApiKeys.isPending ? "Saving..." : "Save Configuration"}
              </Button>
              

            </div>
          </TabsContent>
          
          <TabsContent value="instructions" className="space-y-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">Google Places API Setup</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>1. Go to Google Cloud Console:</strong></p>
                  <a 
                    href="https://console.cloud.google.com/apis/credentials" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    console.cloud.google.com/apis/credentials <ExternalLink className="h-3 w-3" />
                  </a>
                  
                  <p><strong>2. Enable these APIs:</strong></p>
                  <ul className="list-disc ml-6 space-y-1">
                    <li>Places API (New)</li>
                    <li>Places API (Legacy) - for backwards compatibility</li>
                    <li>Geocoding API</li>
                  </ul>
                  
                  <p><strong>3. Create an API Key:</strong></p>
                  <ul className="list-disc ml-6 space-y-1">
                    <li>Click "Create Credentials" → "API Key"</li>
                    <li>Restrict the key to the APIs listed above</li>
                    <li>Set appropriate usage limits to control costs</li>
                  </ul>
                  
                  <p><strong>Estimated Costs:</strong></p>
                  <ul className="list-disc ml-6 space-y-1">
                    <li>Places Text Search: $32 per 1,000 requests</li>
                    <li>Place Details: $17 per 1,000 requests</li>
                    <li>Geocoding: $5 per 1,000 requests</li>
                    <li>Per business found: ~$0.049</li>
                  </ul>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-3">OpenAI API Setup</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>1. Go to OpenAI Platform:</strong></p>
                  <a 
                    href="https://platform.openai.com/api-keys" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    platform.openai.com/api-keys <ExternalLink className="h-3 w-3" />
                  </a>
                  
                  <p><strong>2. Create a new API key:</strong></p>
                  <ul className="list-disc ml-6 space-y-1">
                    <li>Click "Create new secret key"</li>
                    <li>Give it a name for this application</li>
                    <li>Copy the key immediately (you won't see it again)</li>
                  </ul>
                  
                  <p><strong>Used for:</strong></p>
                  <ul className="list-disc ml-6 space-y-1">
                    <li>Generating search term suggestions</li>
                    <li>Creating city lists for state-wide searches</li>
                    <li>AI-powered search optimization</li>
                  </ul>
                  
                  <p><strong>Estimated Costs:</strong></p>
                  <ul className="list-disc ml-6 space-y-1">
                    <li>GPT-4 usage: ~$0.001 per suggestion generation</li>
                    <li>Very low cost compared to Google APIs</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">MongoDB Atlas Setup</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>1. Create a MongoDB Atlas Account:</strong></p>
                  <a 
                    href="https://cloud.mongodb.com/v2/register" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    cloud.mongodb.com/register <ExternalLink className="h-3 w-3" />
                  </a>
                  
                  <p><strong>2. Create a Free Cluster:</strong></p>
                  <ul className="list-disc ml-6 space-y-1">
                    <li>Click "Create" and select "M0 Sandbox" (Free tier)</li>
                    <li>Choose your preferred cloud provider and region</li>
                    <li>Name your cluster (e.g., "BusinessSearchApp")</li>
                  </ul>
                  
                  <p><strong>3. Configure Database Access:</strong></p>
                  <ul className="list-disc ml-6 space-y-1">
                    <li>Go to "Database Access" in the left sidebar</li>
                    <li>Click "Add New Database User"</li>
                    <li>Create a username and strong password</li>
                    <li>Grant "Read and write to any database" permissions</li>
                  </ul>

                  <p><strong>4. Configure Network Access:</strong></p>
                  <ul className="list-disc ml-6 space-y-1">
                    <li>Go to "Network Access" in the left sidebar</li>
                    <li>Click "Add IP Address"</li>
                    <li>Select "Allow access from anywhere" (0.0.0.0/0)</li>
                  </ul>

                  <p><strong>5. Get Connection String:</strong></p>
                  <ul className="list-disc ml-6 space-y-1">
                    <li>Go to "Database" and click "Connect" on your cluster</li>
                    <li>Select "Connect your application"</li>
                    <li>Copy the connection string</li>
                    <li>Replace &lt;password&gt; with your database user password</li>
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}