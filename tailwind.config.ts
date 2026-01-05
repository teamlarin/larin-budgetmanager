import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
    	container: {
    		center: true,
    		padding: '2rem',
    		screens: {
    			'2xl': '1400px'
    		}
    	},
    	extend: {
    		fontFamily: {
    			sans: [
    				'Manrope',
    				'ui-sans-serif',
    				'system-ui',
    				'sans-serif',
    				'Apple Color Emoji',
    				'Segoe UI Emoji',
    				'Segoe UI Symbol',
    				'Noto Color Emoji'
    			],
    			serif: [
    				'Lora',
    				'ui-serif',
    				'Georgia',
    				'Cambria',
    				'Times New Roman',
    				'Times',
    				'serif'
    			],
    			mono: [
    				'Roboto Mono',
    				'ui-monospace',
    				'SFMono-Regular',
    				'Menlo',
    				'Monaco',
    				'Consolas',
    				'Liberation Mono',
    				'Courier New',
    				'monospace'
    			]
    		},
    		backgroundImage: {
    			'gradient-primary': 'var(--gradient-primary)',
    			'gradient-card': 'var(--gradient-card)'
    		},
    		boxShadow: {
    			soft: 'var(--shadow-soft)',
    			medium: 'var(--shadow-medium)'
    		},
    		transitionTimingFunction: {
    			smooth: 'var(--transition-smooth)'
    		},
    		colors: {
    			border: 'hsl(var(--border))',
    			input: 'hsl(var(--input))',
    			ring: 'hsl(var(--ring))',
    			background: 'hsl(var(--background))',
    			foreground: 'hsl(var(--foreground))',
    			primary: {
    				DEFAULT: 'hsl(var(--primary))',
    				foreground: 'hsl(var(--primary-foreground))'
    			},
    			secondary: {
    				DEFAULT: 'hsl(var(--secondary))',
    				foreground: 'hsl(var(--secondary-foreground))'
    			},
    			destructive: {
    				DEFAULT: 'hsl(var(--destructive))',
    				foreground: 'hsl(var(--destructive-foreground))'
    			},
    			muted: {
    				DEFAULT: 'hsl(var(--muted))',
    				foreground: 'hsl(var(--muted-foreground))'
    			},
    			accent: {
    				DEFAULT: 'hsl(var(--accent))',
    				foreground: 'hsl(var(--accent-foreground))'
    			},
    			popover: {
    				DEFAULT: 'hsl(var(--popover))',
    				foreground: 'hsl(var(--popover-foreground))'
    			},
    			card: {
    				DEFAULT: 'hsl(var(--card))',
    				foreground: 'hsl(var(--card-foreground))'
    			},
    			management: 'hsl(var(--management))',
    			design: 'hsl(var(--design))',
    			dev: 'hsl(var(--dev))',
    			content: 'hsl(var(--content))',
    			support: 'hsl(var(--support))',
    			sidebar: {
    				DEFAULT: 'hsl(var(--sidebar-background))',
    				foreground: 'hsl(var(--sidebar-foreground))',
    				primary: 'hsl(var(--sidebar-primary))',
    				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
    				accent: 'hsl(var(--sidebar-accent))',
    				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
    				border: 'hsl(var(--sidebar-border))',
    				ring: 'hsl(var(--sidebar-ring))'
    			}
    		},
    		borderRadius: {
    			lg: 'var(--radius)',
    			md: 'calc(var(--radius) - 2px)',
    			sm: 'calc(var(--radius) - 4px)'
    		},
    		keyframes: {
    			'accordion-down': {
    				from: {
    					height: '0'
    				},
    				to: {
    					height: 'var(--radix-accordion-content-height)'
    				}
    			},
    			'accordion-up': {
    				from: {
    					height: 'var(--radix-accordion-content-height)'
    				},
    				to: {
    					height: '0'
    				}
    			},
    			'float-slow': {
    				'0%, 100%': {
    					transform: 'translate(0, 0) scale(1)'
    				},
    				'50%': {
    					transform: 'translate(30px, -30px) scale(1.05)'
    				}
    			},
    			'float-medium': {
    				'0%, 100%': {
    					transform: 'translate(0, 0) scale(1)'
    				},
    				'50%': {
    					transform: 'translate(-20px, 20px) scale(1.03)'
    				}
    			},
			'float-fast': {
				'0%, 100%': {
					transform: 'translate(0, 0) scale(1)'
				},
				'50%': {
					transform: 'translate(15px, -15px) scale(1.02)'
				}
			},
			'bounce-arrow': {
				'0%, 100%': {
					transform: 'translateY(0)'
				},
				'50%': {
					transform: 'translateY(-8px)'
				}
			},
			'ping-slow': {
				'0%': {
					transform: 'scale(1)',
					opacity: '0.8'
				},
				'75%, 100%': {
					transform: 'scale(1.15)',
					opacity: '0'
				}
			},
			'ping-slower': {
				'0%': {
					transform: 'scale(1)',
					opacity: '0.6'
				},
				'75%, 100%': {
					transform: 'scale(1.25)',
					opacity: '0'
				}
			},
			'shimmer': {
				'0%': {
					transform: 'translateX(-100%)'
				},
				'100%': {
					transform: 'translateX(100%)'
				}
			},
			'spotlight': {
				'0%, 100%': {
					opacity: '0.5',
					transform: 'scale(1)'
				},
				'50%': {
					opacity: '0.8',
					transform: 'scale(1.1)'
				}
			},
			'fade-in': {
				'0%': {
					opacity: '0'
				},
				'100%': {
					opacity: '1'
				}
			},
			'scale-in': {
				'0%': {
					opacity: '0',
					transform: 'translate(-50%, -50%) scale(0.9)'
				},
				'100%': {
					opacity: '1',
					transform: 'translate(-50%, -50%) scale(1)'
				}
			}
		},
		animation: {
			'accordion-down': 'accordion-down 0.2s ease-out',
			'accordion-up': 'accordion-up 0.2s ease-out',
			'float-slow': 'float-slow 20s ease-in-out infinite',
			'float-medium': 'float-medium 15s ease-in-out infinite',
			'float-fast': 'float-fast 10s ease-in-out infinite',
			'bounce-arrow': 'bounce-arrow 1s ease-in-out infinite',
			'ping-slow': 'ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite',
			'ping-slower': 'ping-slower 2.5s cubic-bezier(0, 0, 0.2, 1) infinite 0.5s',
			'shimmer': 'shimmer 2s ease-in-out infinite',
			'spotlight': 'spotlight 2s ease-in-out infinite',
			'fade-in': 'fade-in 0.3s ease-out',
			'scale-in': 'scale-in 0.3s ease-out'
		}
    	}
    },
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
