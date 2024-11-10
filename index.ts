import { Purchase } from "./models/products.interface";

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const port = 3000;

const pg = require("pg");
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_DEV,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const apiRouter = express.Router();

apiRouter.get("/productos", async (req: any, res: any) => {
  console.log("PRODUCTOS");
  let search = req.query.search || ""; // Asignar una cadena vacía si search es undefined
  console.log("search", search);
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT  
                  ID,
                  TITLE,
                  DESCRIPTION,
                  CATEGORY,
                  PRICE,
                  RATING 
          FROM EXAMEN.PUBLIC.PRODUCTS P
          WHERE ($1 = '' OR P.TITLE LIKE '%' || $1 || '%' OR P.DESCRIPTION LIKE '%' || $1 || '%')
          ;`,
      [search]
    );

    let products = result.rows;
    console.log("products", products);
    products = await Promise.all(
      products.map(async (product: any) => {
        let images: string[] = [];

        let result = await client.query(
          `SELECT
                                          URL
                                      FROM EXAMEN.PUBLIC.IMAGES I
                                      WHERE I.PRODUCT_ID = $1;`,
          [product.id]
        );

        let imagesResult = result.rows;
        imagesResult.forEach((image: any) => {
          images.push(image.url);
        });

        product.image = images;

        return product;
      })
    );

    res.send({ message: "Productos Obtenidos", data: products });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error al obtener productos");
  } finally {
    client.release();
  }
});

apiRouter.get("/producto/:id", async (req: any, res: any) => {
  console.log("PRODUCTO");
  let id = req.params.id;
  console.log("id", id);
  const client = await pool.connect();
  const result = await client.query(`SELECT  
                                        ID,
                                        TITLE ,
                                        DESCRIPTION ,
                                        CATEGORY ,
                                        PRICE ,
                                        RATING 
                                    FROM EXAMEN.PUBLIC.PRODUCTS P
                                    WHERE P.ID = ${id}
                                    ;`);

  let products = result.rows;
  console.log("products", products);
  products = await products.map(async (product: any) => {
    let images: string[] = [];

    let result = await client.query(`SELECT
                                        URL
                                    FROM EXAMEN.PUBLIC.IMAGES I
                                    WHERE I.PRODUCT_ID = ${product.id}
                                    ;`);

    let imagesResult = result.rows;
    imagesResult.forEach((image: any) => {
      images.push(image.url);
    });

    product.image = images;

    return product;
  });

  products = await Promise.all(products);

  client.release();
  res.send({ message: "Producto Obtenido", data: products[0] });
});

app.get("/", (req: any, res: any) => {
  res.send("Hello World!");
});

apiRouter.post("/comprar", async (req: any, res: any) => {
  console.log("COMPRA");
  const { id, cantidad } = req.body;
  console.log("id", id);
  console.log("cantidad", cantidad);

  if (!id || !cantidad) {
    return res
      .status(400)
      .send({ message: "Producto y cantidad son requeridos" });
  }

  const client = await pool.connect();
  try {
    // Verificar si el producto existe y obtener su información
    const productResult = await client.query(
      `SELECT ID, TITLE, STOCK FROM EXAMEN.PUBLIC.PRODUCTS WHERE ID = $1;`,
      [id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).send({ message: "Producto no encontrado" });
    }

    const product = productResult.rows[0];

    // Verificar si hay suficiente stock
    if (product.stock < cantidad) {
      return res.status(400).send({ message: "Stock insuficiente" });
    }

    // Actualizar el stock del producto
    await client.query(
      `UPDATE EXAMEN.PUBLIC.PRODUCTS SET STOCK = STOCK - $1 WHERE ID = $2;`,
      [cantidad, id]
    );

    // Registrar la compra (opcional, dependiendo de tu modelo de datos)
    await client.query(
      `INSERT INTO EXAMEN.PUBLIC.PURCHASES (PRODUCT_ID, QUANTITY, PURCHASE_DATE) VALUES ($1, $2, NOW());`,
      [id, cantidad]
    );

    res.send({ message: "Compra realizada con éxito", product });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error al realizar la compra");
  } finally {
    client.release();
  }
});

// Ejemplo de uso en la ruta /compras
apiRouter.get("/compras", async (req: any, res: any) => {
  console.log("COMPRAS");
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
          p.ID AS purchase_id,
          p.PRODUCT_ID,
          p.QUANTITY,
          p.PURCHASE_DATE,
          pr.TITLE,
          pr.DESCRIPTION,
          pr.CATEGORY,
          pr.PRICE,
          pr.RATING,
          (p.QUANTITY * pr.PRICE) AS total
       FROM EXAMEN.PUBLIC.PURCHASES p
       JOIN EXAMEN.PUBLIC.PRODUCTS pr ON p.PRODUCT_ID = pr.ID
       ORDER BY p.PURCHASE_DATE DESC;`
    );

    const purchases: Purchase[] = result.rows;
    console.log("purchases", purchases);
    res.send({ message: "Compras obtenidas con éxito", data: purchases });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error al obtener las compras");
  } finally {
    client.release();
  }
});

app.use("/api", apiRouter);

app.listen(port, () => {
  console.log(`Puerto ${port}`);
  console.log("URL", "http://localhost:3000");
});
