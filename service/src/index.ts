import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import versionRouter from '@/routes/router';

dotenv.config(); //Charge les variables d'environnement

const app: Application = express();
const PORT = process.env.PORT || 3000;
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

// Middlewares
app.use(helmet()); //Sécurisation des headers HTTP
app.use(cors()); //Gestion du Cross Domain Policy
app.use(express.json()); //Permet la transformation du stream HTTP en du json (si content-type=application/json) de façon automatique
app.use(express.urlencoded({ extended: true }));

// Routes
app.use(API_PREFIX, versionRouter);


// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📝 API available at http://localhost:${PORT}${API_PREFIX}`);
});

export default app;
