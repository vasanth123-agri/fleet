import { Request, Response } from 'express';
import * as customerService from '../services/customerService.js';
import * as farmService from '../services/farmService.js';

export async function listCustomers(req: Request, res: Response): Promise<void> {
  try {
    const { page, limit, search, crop, status, deviceCategory, fresh } = req.query;

    const result = await customerService.getCustomers({
      page: page ? parseInt(String(page), 10) : undefined,
      limit: limit ? parseInt(String(limit), 10) : undefined,
      search: search ? String(search) : undefined,
      crop: crop ? String(crop) : undefined,
      status: status ? String(status) : undefined,
      deviceCategory: deviceCategory ? String(deviceCategory) : undefined,
      forceFresh: fresh === 'true',
    });

    res.json({
      success: true,
      data: result.customers,
      pagination: result.pagination,
    });
  } catch (error: any) {
    console.error('Error listing customers:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch customer list',
    });
  }
}

export async function getCustomer(req: Request, res: Response): Promise<void> {
  try {
    const userId = parseInt(String(req.params.userId), 10);
    if (isNaN(userId)) {
      res.status(400).json({ success: false, error: 'Invalid user ID' });
      return;
    }

    const forceFresh = req.query.fresh === 'true';
    const customer = await customerService.getCustomerById(userId, forceFresh);
    if (!customer) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }

    res.json({
      success: true,
      data: customer,
    });
  } catch (error: any) {
    console.error('Error fetching customer details:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch customer details',
    });
  }
}

export async function getCustomerFarms(req: Request, res: Response): Promise<void> {
  try {
    const userId = parseInt(String(req.params.userId), 10);
    if (isNaN(userId)) {
      res.status(400).json({ success: false, error: 'Invalid user ID' });
      return;
    }

    const farms = await farmService.getFarmsByUserId(userId);
    res.json({
      success: true,
      data: farms,
    });
  } catch (error: any) {
    console.error('Error fetching customer farms:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch customer farms',
    });
  }
}
