export interface Gift {
  id: number;
  name: string;
  url: string;
  image: string | null;
  price: number | null;
  category: string | null;
  confirmed: boolean;
  spaceId: number;
  createdAt: string;
  updatedAt: string;
}
