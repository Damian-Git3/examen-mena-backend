export interface IProduct {
  id: number;
  title: string;
  description: string;
  category: string;
  price: number;
  rating: number;
  image: string[];
}

export interface Purchase {
  purchase_id: number;
  product_id: number;
  quantity: number;
  purchase_date: Date;
  title: string;
  description: string;
  category: string;
  price: number;
  rating: number;
  total: number; // Nuevo campo para el total de la compra
}
