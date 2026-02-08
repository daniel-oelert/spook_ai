import argparse

from .interface import server, cli

def main():
    parser = argparse.ArgumentParser(prog="spook_ai")
    subparsers = parser.add_subparsers(dest="command")

    server.config_parser(subparsers.add_parser("server", help="Run in server mode"))
    cli.config_parser(subparsers.add_parser("cli", help="Run in CLI mode"))
    
    args = parser.parse_args()
    if not args.command:
        parser.print_usage()
        return
    args.func(args)

if __name__ == "__main__":
    main()