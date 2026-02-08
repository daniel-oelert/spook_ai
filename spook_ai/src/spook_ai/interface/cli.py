from argparse import ArgumentParser, Namespace

def main(args : Namespace):
    print("cli")

def config_parser(parser : ArgumentParser):
    parser.set_defaults(func=main)