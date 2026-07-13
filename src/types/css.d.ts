// Allow importing stylesheets (NativeWind global.css side-effect + CSS modules).
declare module "*.css";
declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}
