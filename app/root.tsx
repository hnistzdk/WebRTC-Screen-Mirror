import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body>
				{children}
				<ScrollRestoration />
				<Scripts />
				<script
					defer
					data-site-id="mirror.doveliao.com"
					src="https://assets.onedollarstats.com/tracker.js"
				></script>
			</body>
		</html>
	);
}

export default function App() {
	return (
		<ChakraProvider value={defaultSystem}>
			<Outlet />
		</ChakraProvider>
	);
}
