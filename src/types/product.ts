export interface Product {
  code: string;
  url: string;
  product_name: string;
  brands: string;
}

export interface ProductSearchResult {
  products: Product[];
  total: number;
}
