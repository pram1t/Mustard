/**
 * OpenAgent CLI - API Client
 *
 * HTTP client for communicating with the OpenAgent API server.
 */

export interface ApiClientConfig {
  baseUrl: string;
  apiKey?: string;
}

export class ApiClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.headers = {
      'Content-Type': 'application/json',
    };
    if (config.apiKey) {
      this.headers['Authorization'] = `Bearer ${config.apiKey}`;
    }
  }

  async health(): Promise<any> {
    return this.get('/health');
  }

  async submitRequest(prompt: string, context?: string): Promise<any> {
    return this.post('/api/requests', { prompt, context });
  }

  async getPlan(planId: string): Promise<any> {
    return this.get(`/api/plans/${planId}`);
  }

  async approvePlan(planId: string): Promise<any> {
    return this.post(`/api/plans/${planId}/approve`, {});
  }

  async rejectPlan(planId: string): Promise<any> {
    return this.post(`/api/plans/${planId}/reject`, {});
  }

  async listWorkers(): Promise<any> {
    return this.get('/api/workers');
  }

  async getWorker(role: string): Promise<any> {
    return this.get(`/api/workers/${role}`);
  }

  async listTasks(status?: string): Promise<any> {
    const query = status ? `?status=${status}` : '';
    return this.get(`/api/tasks${query}`);
  }

  async getTask(taskId: string): Promise<any> {
    return this.get(`/api/tasks/${taskId}`);
  }

  async listArtifacts(projectId?: string, type?: string): Promise<any> {
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    if (type) params.set('type', type);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.get(`/api/artifacts${query}`);
  }

  private async get(path: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.headers,
    });
    return this.handleResponse(res);
  }

  private async post(path: string, body: any): Promise<any> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });
    return this.handleResponse(res);
  }

  private async handleResponse(res: Response): Promise<any> {
    const data = await res.json() as any;
    if (!res.ok) {
      throw new Error(data.message || `API error: ${res.status}`);
    }
    return data;
  }
}
