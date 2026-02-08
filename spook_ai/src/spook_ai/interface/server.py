
from argparse import ArgumentParser, Namespace

def main(args : Namespace):
    
    if args.mode == "stdio":
        print("stdio mode")

def config_parser(parser : ArgumentParser):
    parser.add_argument("-m", "--mode", required=True, choices=("stdio","tcp"))
    parser.set_defaults(func=main)